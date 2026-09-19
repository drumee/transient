# Rapport R1 — première publication npm des runtimes

Date du rapport : 19 septembre 2026

Périmètre : jalon R1 uniquement

Statut : **CLÔTURÉ**

## 1. Synthèse exécutive

Les deux runtimes autonomes issus du jalon R0 ont été publiés sur le registre
npm en version `0.1.0-alpha.1` :

- `@drumee/server-runtime@0.1.0-alpha.1` ;
- `@drumee/ui-runtime@0.1.0-alpha.1`.

Les archives disponibles sur npm correspondent exactement aux contenus
préparés dans les dépôts autonomes. Cette correspondance a été vérifiée par les
empreintes SHA-1 et SHA-512, le nombre de fichiers et la taille décompressée.
Les suites de tests des deux dépôts passent intégralement et des installations
neuves depuis le registre npm ont chargé avec succès les API attendues, sans
recours à `NODE_PATH`.

Les versions alpha sont exposées par les tags npm `next` et `latest`. `next`
est bien le canal de préversion prévu. Le registre npm impose toutefois la
présence de `latest` dans les métadonnées d'un paquet. Comme l'alpha est
l'unique version publiée de chaque nouveau paquet, `latest` désigne
nécessairement le même artefact. Une tentative authentifiée de suppression a
été refusée par le registre avec HTTP 400 : il ne s'agit donc pas d'un échec de
token ou de 2FA.

R1 accepte cette contrainte externe plutôt que de publier une fausse version
stable uniquement pour déplacer le tag. Le jalon est clôturé. La Phase 4.6 n'a
pas commencé et reste soumise à une autorisation explicite.

## 2. Artefacts publiés

| Paquet | Version | Commit préparé | Publication UTC |
| --- | --- | --- | --- |
| `@drumee/server-runtime` | `0.1.0-alpha.1` | `e582f708ad85579d7c1238d361a32b5e486c08be` | `2026-09-19T14:42:05.963Z` |
| `@drumee/ui-runtime` | `0.1.0-alpha.1` | `75a67fb2efbbc0db69db54b5d3c08c49a8fccc20` | `2026-09-19T14:42:16.575Z` |

Au moment de la validation, les deux dépôts autonomes étaient propres, sur la
branche `main` et synchronisés avec `origin/main`.

## 3. Preuves d'intégrité

Une nouvelle exécution locale de `npm pack --dry-run --json` sur chacun des
commits préparés a produit les mêmes métadonnées que le registre npm :

| Paquet | Fichiers | Taille décompressée | SHA-1 | Intégrité SHA-512 |
| --- | ---: | ---: | --- | --- |
| server runtime | 25 | 130197 octets | `2bd53842ebfaad72e63897ee0682d9ed7aba0264` | `sha512-665KKd9/qoLWSZxYz3yCfMr+5gQTyDapFj2T9kgj9ET+Ftu6PA5hLAJesJEGm8P68zS3kfPfb170aEiJqKaOEg==` |
| UI runtime | 21 | 129246 octets | `1fd9308470aead70e3537a626bff2862cf525257` | `sha512-dACvcMrviBOSoyv9/qb9PIVX/XrC1j4ru1F2PB1yRy6zoZiYvwQh30utlRRumR7nNeOrVziKrKcrjwEsqRXC6Q==` |

Cette égalité démontre que les paquets publics proviennent des commits préparés
et non d'une variante locale non tracée.

## 4. Résultats de validation

| Contrôle | Résultat |
| --- | --- |
| Tests autonomes de `server-runtime` | **PASS — 34/34** |
| Tests autonomes de `ui-runtime` | **PASS — 22/22** |
| Installation neuve du serveur depuis npm | **PASS** |
| Chargement de `createServiceServer`, `SessionManager` et `WebSocketPushRouter` | **PASS** |
| Installation neuve de l'UI depuis npm | **PASS** |
| Résolution d'un plugin par `Kind.loadPlugin` depuis le paquet installé | **PASS** |
| Exécution des consommateurs avec `NODE_PATH` désactivé | **PASS** |
| Égalité des archives locales et publiées | **PASS** |
| `git diff --check` dans `transient` | **PASS** |
| `git diff -- sources/` | **PASS — vide** |

L'installation du runtime serveur affiche un avertissement de dépréciation pour
`yaeti@0.0.6`, dépendance transitive de `websocket@1.0.35`. Cet avertissement ne
remet pas en cause l'intégrité ou la validation du paquet R1 et n'autorise pas
une migration de dépendance dans ce jalon.

## 5. Contrainte du registre npm

État actuel des tags pour chacun des deux paquets :

```text
latest: 0.1.0-alpha.1
next:   0.1.0-alpha.1
```

Le tag fonctionnel de préversion reste `next`. Les consommateurs doivent le
demander explicitement, ou demander la version exacte :

```bash
npm install @drumee/server-runtime@next
npm install @drumee/ui-runtime@next
```

Le registre refuse la suppression de `latest` par HTTP 400 car il doit conserver
ce champ et aucune autre version n'existe. La publication d'une version stable
artificielle pour contourner cette règle est explicitement exclue.

## 6. Modifications documentaires en attente dans `transient`

Les changements locaux non encore commités sont limités au suivi de R1 :

- `AGENTS.md` marque R1 comme clôturé ;
- `PROJECT_STATE.md` enregistre les artefacts, empreintes et la contrainte npm ;
- `ARCHITECTURE.md` référence le dossier de preuve R1 ;
- `docs/refactoring/22-r1-runtime-release.md` contient le dossier d'audit
  détaillé en anglais ;
- le présent document fournit le rapport en français.

Aucun fichier sous `sources/**` n'a été modifié.

## 7. Décision et prochaine action

Décision : **clôturer R1** avec `next` comme canal de préversion explicite et
`latest` comme contrainte de métadonnées npm documentée.

La prochaine étape planifiée est la Phase 4.6. Sa mise en œuvre n'est pas
autorisée par cette clôture et nécessitera toujours une demande explicite.
