# Rapport final — Phase 4.8B Hub lifecycle, authorized context & schema propagation

Date du rapport : 2026-10-08
Verdict : **PHASE 4.8B CLÔTURÉE / VALIDÉE**

## 1. Résumé exécutif

La Phase 4.8B livre la capacité générique qui manquait entre une session
Drumee authentifiée et l'utilisation de données structurées dans un Hub privé :

```text
principal authentifié et autorisé
→ requête idempotente de création
→ identité opaque de Hub
→ association durable à un shard MariaDB
→ enregistrement Yellow Pages
→ ACL Hub read/write
→ résolution du plan de schémas
→ provisioning ordonné, persistant et reprenable
→ contexte Hub interne autorisé transmis au service
```

La capacité est indépendante d'Oxymotion. Elle ne contient aucun objet métier
`oxy_`, aucune politique Team/Desk/DMZ, aucun code Finder et aucun SQL MFS.
`system-mfs` participe comme provisioner de confiance sur un shard déjà créé.

L'implémentation est hébergée transitoirement dans `transient`, sous
`target/control-plane/hub-lifecycle`. Cette localisation ne constitue pas une
décision de dépôt public final.

## 2. Dépôts, branches et états inspectés

| Dépôt | Branche | HEAD inspecté | Rôle pendant 4.8B | Modification |
|---|---|---|---|---|
| `transient` | `refactor/mapping` | `b4d755cda1722f312c436f69b7900616c99f2cad` au démarrage | dépôt autorisé pour l'implémentation | oui, changements non commités |
| `server-runtime` | `main` | `d17ecee8c645f1d14a7e2ef45a2f3542a27c0763` | frontière standalone inspectée | non |
| `system-mfs` | `main` | `a7f7395bdbc79560aed072219b87c0b81c004bce` | provisioner réel et manifeste historique | non |
| `finder` | `main` | `730aa309939f956d76f70beeed5d9e46846c0574` | artefact futur à revalider | non |
| `window-manager` | `main` | `e294979dfcb59f73af19975e40f890a0b366cd8c` | contrat Finder futur | non |
| `ui-runtime` | `main` | `5366d904356b414e87848a0bc8870b612e6c748a` | contrat UI futur | non |
| `oxymotion` | `main` | `2bdcd556daa55457b0b99e1c684a55dfd03dc794` | consommateur consulté, non intégré | non |

Le répertoire non suivi `oxymotion/node_modules/` existait avant la mission et
a été préservé. Aucun commit ni push n'a été effectué. Aucun package npm n'a
été publié.

## 3. Divergence documentaire concernant la Phase 4.9

Le dépôt contient :

- un checkout autonome Finder ;
- des commits d'extraction et de publication ;
- des rapports historiques déclarant 4.9 clôturée/publiée ;
- une publication npm Finder enregistrée dans ces rapports.

En parallèle, `AGENTS.md` indiquait toujours 4.9 comme `PLANNED`. La mission a
explicitement imposé la nouvelle séquence :

```text
4.8B → 4.9 → validation de bout en bout avec Oxymotion
```

Décision appliquée : les anciens artefacts 4.9 restent des faits auditables,
mais ne constituent pas la preuve du gate courant. La Phase 4.9 devra être
revalidée avec le cycle de vie et le contexte Hub livrés par 4.8B.

La roadmap, le plan de migration et `AGENTS.md` ont été alignés sur cette
séquence.

## 4. Frontières architecturales livrées

### 4.1 Control plane / capacité Hub

`target/control-plane/hub-lifecycle` possède :

- création/reprise d'un Hub privé ;
- portée et empreinte d'idempotence ;
- identité opaque et association au shard ;
- registre Yellow Pages `entity`/`hub` ;
- ACL Hub ;
- lecture et normalisation des manifestes ;
- graphe transitif des dépendances ;
- détection de cycles, absences, désactivations et collisions ;
- plan immuable avec références d'artefacts ;
- orchestration des handlers de confiance ;
- états Hub/capacité, tentatives, erreurs et reprise ;
- propagation et mises à niveau paginées.

### 4.2 `server-runtime`

La copie transitoire du runtime possède uniquement :

- le scope d'autorisation `hub` ;
- la validation de la session authentifiée ;
- la sélection d'un identifiant Hub opaque ;
- la délégation à un résolveur injecté ;
- la transmission d'un `hub_context` interne au worker.

Elle ne crée ni Hub, ni shard, ni ACL, ni plan et n'exécute aucun provisioner.

### 4.3 `system-mfs`

Le package standalone reste propriétaire de ses tables, fonctions,
procédures, état de provisioning et initialisation MFS. Le handler 4.8B lui
fournit un shard Hub déjà attribué. Le test réel utilise directement le checkout
standalone ; aucune copie de production MFS n'a été introduite.

### 4.4 Modules applicatifs

Chaque module conserve :

- son unique `SCHEMA_MANIFEST.json` ;
- sa version de schéma existante ;
- ses migrations et objets SQL ;
- son handler versionné et idempotent.

Le control plane décide quand et pour quels Hubs le handler est exécuté.

## 5. API et DTO stabilisés

### 5.1 Création

```js
await lifecycle.createPrivateHub({
  session,                 // session serveur vérifiée
  creator_module,          // identité fixée par le serveur
  specification: {
    idempotency_key,
    name
  }
});
```

Résultat public :

```json
{
  "hub_id": "opaque-16-char-id",
  "status": "ready"
}
```

Le résultat n'expose ni base physique, ni hôte SQL, ni credentials, ni chemin
filesystem.

Les champs publics suivants sont refusés :

```text
database_name
db_name
db_host
fs_host
home_dir
home_id
credentials
creator_module
inherit
```

### 5.2 Portée d'idempotence

La clé est scoped par :

```text
organisation_id + creator_uid + creator_module + idempotency_key
```

L'empreinte couvre le module créateur, l'organisation, le principal et les
attributs publics. Une relance identique reprend le même Hub et le même shard.
Une demande incompatible avec la même clé retourne
`HUB_IDEMPOTENCY_CONFLICT`.

### 5.3 Résolution interne autorisée

Entrée interne :

```js
{
  hub_id,
  uid,
  organisation_id,
  permission: "read" | "write",
  capabilities: ["module-id"]
}
```

Descripteur interne après validation :

```js
{
  hub_id,
  type: "hub",
  organisation_id,
  uid,
  permission,
  database_name,
  db_host,
  fs_host,
  home_dir,
  home_id,
  authorized: true
}
```

Le runtime transmet ce descripteur au worker sous `hub_context`. Les paramètres
du service ne peuvent pas le remplacer.

## 6. Autorité et ACL Hub

La politique initiale est :

- tout Drumate complètement authentifié peut créer dans son organisation
  courante, sous réserve du callback de politique `can_create` injecté ;
- le créateur reçoit `read + write` ;
- un contexte `write` autorisé peut attribuer `read` ou `write` ;
- `write` implique `read` ;
- `read` n'accorde pas `write` ;
- une permission Domain seule n'accorde aucun Hub.

Les identités anonymes, nobody, guest et les sessions OTP/intermédiaires sont
refusées. Le résolveur vérifie l'organisation, le type `hub`, l'association au
shard, l'existence de la base, le plan de création `ready`, l'ACL demandée et
l'état `ready` des capacités consommées.

Les refus sont fermés et utilisent des codes explicites, notamment :

```text
HUB_AUTHENTICATION_REQUIRED
HUB_PRINCIPAL_INVALID
HUB_SELECTION_REQUIRED
HUB_PERMISSION_DENIED
HUB_ORGANISATION_MISMATCH
HUB_SHARD_UNAVAILABLE
HUB_NOT_READY
HUB_CAPABILITY_NOT_READY
```

## 7. Contrat canonique `SCHEMA_MANIFEST.json`

Le manifeste canonique d'un nouveau module est :

```text
server/schemas/SCHEMA_MANIFEST.json
```

Aucun `capacities.json` parallèle n'a été créé.

Les champs ajoutés sont :

```json
{
  "inherit": "installed",
  "requires": ["system-mfs"]
}
```

### 7.1 `inherit`

- absent : équivaut à `installed` ;
- `installed` : sélectionne toutes les contributions Hub installées et actives,
  plus le créateur ;
- `own` : sélectionne le créateur et la fermeture transitive de ses
  dépendances ;
- toute autre valeur est refusée.

Seul le manifeste du créateur décide de la politique. L'`inherit` d'une
dépendance ne relance jamais une propagation globale.

### 7.2 `requires`

- absent : équivaut à `[]` ;
- résolution transitive ;
- dépendances avant le module dépendant ;
- absence, désactivation, incompatibilité de version ou cycle : erreur avant
  exécution ;
- aucune activation automatique.

Un objet optionnel peut contraindre le `schemaVersion` déjà existant :

```json
{
  "module": "system-mfs",
  "schemaVersion": "phase4.8-system-mfs-2"
}
```

Il ne s'agit pas d'un second système de versionnement.

### 7.3 Cibles et propriété

Les entrées `provision`, `migrations` ou `install` ciblant `hub` contribuent au
shard Hub. Les classes historiques `common` et `hub` sont normalisées vers
cette cible. Les cibles Yellow Page, plateforme, principal et Drumate ne sont
pas propagées au shard.

Chaque objet reçoit une clé :

```text
target:object_type:object_name
```

Deux modules ne peuvent pas revendiquer la même clé.

### 7.4 Compatibilité

Le manifeste standalone `system-mfs` utilise encore le chemin historique
`schemas/SCHEMA_MANIFEST.json`. Il est accepté pendant la migration, normalisé
avec `inherit: installed`, `requires: []` et ses entrées `common` comme
contributions Hub. Les nouveaux modules fixtures utilisent le chemin canonique.

La migration physique du manifeste standalone vers `server/schemas` nécessite
une livraison autorisée dans son propre dépôt ; elle n'a pas été réalisée en
contournant la règle qui limite les modifications à `transient`.

## 8. Plan et modèle persistant

| Table | Responsabilité |
|---|---|
| `hub` | registre minimal du Hub et de son propriétaire |
| `hub_lifecycle` | créateur, politique, shard immuable, état global |
| `hub_idempotency` | portée, empreinte et Hub associé à la demande |
| `hub_acl` | permissions read/write par principal |
| `hub_plan` | snapshot immuable, type create/upgrade, curseur, état |
| `hub_capability` | version cible/appliquée, état, tentative, erreur |
| `hub_schema_object` | propriété des objets SQL par module |

Le snapshot du plan contient :

- module créateur et politique ;
- modules ordonnés ;
- versions package et schéma ;
- dépendances ;
- checksum du manifeste ;
- référence d'artefact ;
- clés d'objets revendiquées.

Une modification ultérieure du registre ne réécrit pas un plan. Un artefact
modifié pendant l'exécution est refusé avec `PLAN_ARTIFACT_CHANGED`.

## 9. Pannes, concurrence et reprise

La séquence durable est volontairement fractionnée :

```text
réservation idempotente
→ enregistrement Hub/entity en état allocating
→ CREATE DATABASE IF NOT EXISTS
→ attribution au compte runtime
→ état provisioning
→ plan immuable
→ états capability + handlers
→ plan create ready
→ Hub ready
```

Cette organisation évite de créer un shard physique sans association durable.
Une interruption avant `CREATE DATABASE` reprend l'association `allocating`.

Pour chaque capacité :

- `provisioning`, `ready` ou `failed` ;
- version cible et version appliquée ;
- numéro de tentative ;
- erreur bornée ;
- référence au plan et à l'artefact.

Un échec conserve le Hub, le shard, les objets et les capacités déjà prêtes.
Une reprise utilise le même plan et la même base. Les étapes prêtes ne sont pas
rejouées. Le handler doit néanmoins supporter le cas où son SQL a réussi juste
avant une panne de l'orchestrateur.

La contrainte unique d'idempotence garantit que deux créations concurrentes de
la même demande convergent vers un Hub, une entité et un shard.

## 10. Propagation ultérieure

Les Hubs `installed` reçoivent les nouvelles contributions actives par un
nouveau plan d'upgrade. Les Hubs `own` recalculent uniquement le créateur et ses
dépendances transitives.

Les scans :

- utilisent un curseur Hub ;
- sont bornés entre 1 et 500 entrées ;
- sont idempotents et reprenables ;
- ne modifient jamais un ancien plan ;
- ne suppriment rien lors d'une désactivation.

Pendant une mise à niveau, les capacités déjà `ready` restent utilisables. Un
service exigeant la capacité en échec ou non prête est refusé. Si le module
créateur devient indisponible, aucun nouveau plan n'est produit, mais les
données et capacités prêtes existantes restent intactes.

## 11. Matrice des critères de validation

| # | Critère | Preuve | Résultat |
|---:|---|---|---|
| 1 | Deux Hubs A/B et deux shards | scénario MariaDB | réussi |
| 2 | Contributions installées automatiquement | `system-mfs` + fixtures | réussi |
| 3 | `installed` inclut les contributeurs actifs | tables des fixtures dans A | réussi |
| 4 | `own` suit créateur + dépendances seulement | MFS + own dans B, installed/later absents | réussi |
| 5 | défaut `installed`, valeur invalide refusée | test manifeste | réussi |
| 6 | ordre, manque et cycle | tests du graphe | réussi |
| 7 | pas de propagation par l'`inherit` dépendant | test `own-app → system-mfs` | réussi |
| 8 | plan immuable face au registre | snapshot puis ajout de module | réussi |
| 9 | échec partiel et reprise même Hub/shard | panne après SQL réel | réussi |
| 10 | relance et concurrence idempotentes | unité + MariaDB concurrent | réussi |
| 11 | procédure via session/contexte autorisés | `ServiceDispatcher` + procédure fixture | réussi |
| 12 | refus sans droit et write au lecteur | ACL MariaDB | réussi |
| 13 | paramètres B incapables de détourner A | `database_name=B`, procédure exécutée dans A | réussi |
| 14 | sélection explicite de B sans droit refusée | résolution ACL | réussi |
| 15 | sentinelle préservée et collisions refusées | upgrade réel + test ownership | réussi |
| 16 | seconde copie et persistance | rechargement du package depuis `/tmp` | réussi |
| 17 | nouveau module propagé à installed, exclu de own | fixture `later-module` | réussi |
| 18 | upgrade paginé et reprenable | page de taille 1 + reprise | réussi |
| 19 | désactivation sans suppression | table `later` conservée | réussi |
| 20 | aucun secret/nom physique exposé | audit du résultat public | réussi |

Le scénario réel vérifie aussi une opération MFS dans le shard nouvellement
créé et les permissions Hub avant l'accès applicatif.

## 12. Tests exécutés

Commande canonique :

```bash
scripts/test-env/kernel/phase4.8b-validation.sh
```

Résultats :

| Suite | Résultat |
|---|---:|
| control plane Hub lifecycle | 9/9 |
| runtime Hub ciblé | 3/3 |
| scénario intégré MariaDB réel | 1/1 |
| régression complète server-runtime | 42/42 |
| régression standalone system-mfs | 9/9 |

Le script démarre des conteneurs nommés uniquement
`transient-kernel-phase48b*`, puis les supprime avec un trap. La vérification
finale n'a trouvé aucun conteneur `transient-kernel-*` résiduel.

## 13. Packaging

Artefact privé préparé, non publié :

```text
package:       @drumee/hub-lifecycle-transitional@0.0.0-phase4.8b
files:         9
unpacked size: 39,083 bytes
sha1:          b4dc87dcbfcb24ea944c6227161c379dfeed0f82
sha512:        8DXx/37qQX8+WT8iZ+mNxS7mZDFxg3oiQm++jMmMjsXYjb/qaMj8razEYeFKZ8dPlh7NuV4DPPTbW0n4a6AJHg==
```

Le package contient uniquement `lib/`, `schemas/`, README, provenance et
métadonnées. Aucun test, source historique, dépendance embarquée ou secret.

## 14. Fichiers principaux livrés

```text
target/control-plane/hub-lifecycle/
  lib/errors.js
  lib/index.js
  lib/manifest.js
  lib/registry.js
  lib/store.js
  schemas/001-hub-lifecycle.sql
  test/hub-lifecycle.test.js
  README.md
  PROVENANCE.md
  package.json

target/foundation/server-runtime/
  lib/hub-authorizer.js
  lib/permission.js
  lib/dispatcher.js
  lib/index.js
  test/hub-authorization.test.js

tests/fixtures/phase4.8b/
tests/integration/kernel/phase4.8b-hub-lifecycle-live.test.js
scripts/test-env/kernel/phase4.8b-validation.sh
```

Documentation mise à jour :

```text
AGENTS.md
docs/refactoring/07-migration-plan.md
docs/refactoring/23-kernel-roadmap.md
docs/refactoring/30-phase4.8b-hub-lifecycle.md
```

## 15. Compatibilité et limites

- CommonJS, Node.js 18+ et conventions `snake_case` sont préservés.
- Les schémas historiques sont lus sans introduire un second manifeste.
- `sources/**` est strictement inchangé.
- Les dépôts standalone inspectés sont inchangés.
- La capacité Hub est encore transitoire dans `transient`.
- Le seam Hub devra être extrait vers le standalone `server-runtime` lors d'une
  livraison autorisée.
- Le manifeste `system-mfs` devra migrer physiquement vers le chemin canonique
  lors d'une livraison de son dépôt ; sa sémantique est déjà validée.
- La gestion administrative avancée, la suppression complète, le partage,
  Team, Chat et DMZ restent hors périmètre.
- Aucune validation de production ou migration d'une base existante réelle
  n'a été effectuée ; toutes les mutations ont ciblé MariaDB jetable.

## 16. Préparation nécessaire pour la Phase 4.9

La Phase 4.9 devra :

1. revalider Finder contre un Hub créé par 4.8B ;
2. sélectionner le Hub par identifiant opaque ;
3. exécuter les services Finder avec le `hub_context` injecté ;
4. exiger `system-mfs` en état `ready` ;
5. prouver qu'aucun paramètre navigateur ne choisit le shard physique ;
6. préserver les contrats standalone Window Manager, UI runtime et MFS ;
7. réévaluer les artefacts Finder historiques sans supposer la clôture 4.9.

Après cette revalidation seulement, Oxymotion pourra remplacer ses interfaces
d'attente `hubResolver`/`hubContext` par l'adaptateur officiel et exécuter sa
validation bout en bout. Ses objets `oxy_` resteront intégralement sous sa
propriété.

## 17. Conclusion

Les conditions de clôture spécifiques à 4.8B sont satisfaites : création réelle,
association durable du shard, ACL, contextes autorisés, deux politiques de
propagation, provisioning automatique, persistance, concurrence et reprise ont
été démontrés dans MariaDB isolée avec le runtime et `system-mfs` réels.

**Verdict final : PHASE 4.8B CLÔTURÉE.**
