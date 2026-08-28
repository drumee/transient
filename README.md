# transient

Temporary controlled refactoring monorepo for the Drumee Minimal OS project.

This repository is a staging and integration workspace. It is not the future `drumee-os` repository. Final repositories, including the future `drumee-os`, will be extracted from validated content under `target/**` after architectural boundaries are approved.

## Important

- `sources/**` is the immutable compatibility baseline.
- Mapping work goes to `docs/refactoring/**`.
- Future implementation goes to `target/**`.
- Compatibility and reconstruction tests go to `tests/**`.
- Read `AGENTS.md` before making any change.

The current Drumee Team repositories remain untouched. New repository
boundaries will be extracted from `target/**` only after the architecture
has been validated.

`transient` is intentionally temporary. It must not become the final
`drumee-os` repository merely by renaming it. The final `drumee-os` and
other repositories will be produced by history-preserving extraction after
their boundaries have been approved and compatibility has been demonstrated.
