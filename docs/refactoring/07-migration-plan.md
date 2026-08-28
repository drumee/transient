# Migration Plan

No phase begins without architectural approval. Each extraction follows baseline test → coexistence adapter → target → same test → artifact/manifest rollback.

| Phase | Goal / prerequisites | Compatibility, tests and rollback | Impact / risk / benefit |
|---|---|---|---|
| 0 | Approve maps and freeze external/service/procedure behavior | Verify source hashes; docs-only rollback | Low; auditable baseline |
| 1 | Build baseline compatibility harness | Boot/auth/ACL, provisioning, MFS, UI, CLI DB, Docker/native; target later runs same cases | Critical missing safety net |
| 2 | Normalize descriptor without loader changes | Adapters for ACL JSON, UI `index.json`, seeds and Debian inputs; conformance fixtures | Medium; stable vocabulary |
| 3 | Isolate OS bootstrap/dispatch beside baseline | Preserve URLs/config/package behavior; boot/session/ACL/loby/signin load tests; switch back to old boot | Critical; establishes host |
| 4 | Stabilize provisioning/MFS contracts | Test drumate/hub create/purge, pool exhaustion, import/export, ACL and storage; retain CLI DB | Critical; prevents data loss |
| 5 | Extract one low-coupling system module | Start with signin frontend or previewer; route/kind/assets/locale equivalence; manifest rollback | Medium; proves contract |
| 6 | Extract Finder from MFS engine | Browse/upload/DnD/share/trash/export equivalence; MFS stays OS; old Finder selectable | Critical; proves application boundary |
| 7 | Extract Team families one at a time | Chat, tasks, meetings with owned schema migrations and Team reconstruction tests | Critical; realizes distribution |
| 8 | Add stable administrative API | DB/API parity first for reads, then destructive commands; retain DB adapter | High; removes direct coupling |
| 9 | Integrate module lifecycle | Only with validation, auth/audit, schema transaction, health and rollback | Critical; extensibility |
| 10 | Make self-hosting artifact-driven | Fresh install/upgrade/rollback/existing-install tests on Docker and native | Critical; reproducible delivery |
| 11 | Approve history-preserving repository extraction | Rehearse extraction after boundaries pass tests | Medium; final maintainability |

All new work in a later phase must remain beside immutable `sources/**`; rollback never rewrites the baseline.
