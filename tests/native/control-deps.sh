#!/bin/bash
# Validate the NATIVE channel's packaging metadata (deterministic, no Docker):
#
#   1. inter-package Depends encode the required config order
#      (apt/dpkg configure a package only after its Depends — so correct edges
#       + an acyclic graph == correct install/configuration order):
#         infra → schemas → static → server-pod → ui-pod
#   2. the `drumee` metapackage pulls all five components
#   3. every debconf key in the rendered preseed has a matching package Template
#
# This tests the packaging we control. Full install validation (postinst running
# as root, services starting) still requires a disposable Debian VM — see
# docs/native-channel.md.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$root"
pass=0; fail=0
ok(){ printf '  \033[1;32mPASS\033[0m %s\n' "$1"; pass=$((pass+1)); }
no(){ printf '  \033[1;31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }

# drumee-* tokens in a component's Depends (own name excluded)
deps(){ awk '/^Depends:/{f=1} f{print} /^Description:/{f=0}' "$1/debian/control" \
  | tr '\n' ' ' | grep -oE 'drumee-[a-z-]+' | grep -vx "$2" | sort -u | paste -sd' ' - ; }
has(){ echo " $1 " | grep -q " $2 "; }   # has "<set>" <member>

printf '\033[1;36m── native: inter-package Depends (config order)\033[0m\n'
S=$(deps schemas drumee-schemas); T=$(deps static drumee-static)
V=$(deps server drumee-server-pod); U=$(deps ui drumee-ui-pod); I=$(deps infra drumee-infra)
has "$S" drumee-infra        && ok "schemas Depends infra"            || no "schemas must Depend infra (got: $S)"
has "$T" drumee-infra        && ok "static Depends infra"             || no "static must Depend infra (got: $T)"
has "$V" drumee-schemas       && ok "server-pod Depends schemas"       || no "server must Depend schemas (got: $V)"
has "$V" drumee-static        && ok "server-pod Depends static"        || no "server must Depend static (got: $V)"
has "$U" drumee-server-pod    && ok "ui-pod Depends server-pod"        || no "ui must Depend server-pod (got: $U)"
[ -z "$I" ]                   && ok "infra has no drumee Depends (base)" || no "infra should be the base (got: $I)"

printf '\033[1;36m── native: acyclic + topological order exists\033[0m\n'
# Kahn's algorithm over the 5 nodes; edges = "dep must precede pkg".
order=$(awk -v edges="infra>schemas infra>static schemas>server static>server server>ui" '
BEGIN{
  n=split("infra schemas static server ui",N," ");
  ne=split(edges,E," ");
  for(i=1;i<=ne;i++){split(E[i],ab,">"); from=ab[1]; to=ab[2]; adj[from]=adj[from] to " "; indeg[to]++}
  # queue nodes with indegree 0, stable by declared order
  out=""; cnt=0;
  while(1){
    pick="";
    for(i=1;i<=n;i++){ if(!(N[i] in done) && indeg[N[i]]+0==0){pick=N[i]; break} }
    if(pick==""){break}
    done[pick]=1; out=out pick " "; cnt++;
    m=split(adj[pick],a," "); for(j=1;j<=m;j++){ if(a[j]!=""){indeg[a[j]]--} }
  }
  if(cnt==n){print out} else {print "CYCLE"}
}')
[ "$order" != "CYCLE" ] && ok "graph is acyclic (order: $order)" || no "dependency cycle detected"
# every required edge respected in the produced order
pos(){ echo "$order" | tr ' ' '\n' | grep -n "^$1$" | cut -d: -f1; }
for e in "infra schemas" "infra static" "schemas server" "static server" "server ui"; do
  set -- $e; [ "$(pos $1)" -lt "$(pos $2)" ] && ok "$1 before $2" || no "$1 not before $2"
done

printf '\033[1;36m── native: metapackage pulls all five\033[0m\n'
M=$(awk '/^Depends:/{f=1} f{print} /^Description:/{f=0}' meta/debian/control | grep -oE 'drumee-[a-z-]+' | sort -u | paste -sd' ' -)
for c in drumee-infra drumee-schemas drumee-static drumee-server-pod drumee-ui-pod; do
  has "$M" "$c" && ok "meta Depends $c" || no "meta missing $c"
done

printf '\033[1;36m── native: debconf preseed keys all have templates\033[0m\n'
tmpl=$(grep -rhoE '^Template: [^[:space:]]+' */debian/templates 2>/dev/null | awk '{print $2}' | sort -u)
cfg=$(mktemp); cat > "$cfg" <<YAML
instance:
  description: T
  domain: example.com
  admin_email: a@b.co
tls:
  mode: acme
  acme_email: a@b.co
YAML
preseed=$(node config/render.mjs debconf --config "$cfg" 2>/dev/null | awk 'NF>=3 && $1 ~ /^drumee/{print $2}' | sort -u)
rm -f "$cfg"
miss=0
for k in $preseed; do echo "$tmpl" | grep -qx "$k" || { no "preseed key has no Template: $k"; miss=1; }; done
[ "$miss" = 0 ] && [ -n "$preseed" ] && ok "all $(echo "$preseed" | wc -w) preseed keys have matching Templates"

printf '\n\033[1m== native control-deps: %d passed, %d failed ==\033[0m\n' "$pass" "$fail"
[ "$fail" = 0 ]
