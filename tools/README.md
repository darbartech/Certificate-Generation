# tools/ — Experimental Artifacts

Files here are scratch/debug utilities used during implementation.

They are **NOT** maintained for production use and may be deleted without notice.

## Status

- **Environment:** Development only — never reference these from `src/`, `scripts/`, or any production build path.
- **No Semver:** Breaking changes to any file in this folder happen at any time.
- **Support:** None. If a utility in here becomes useful, promote it to `scripts/` after code review.

## Promotion rules to `scripts/`

Before moving any file from `tools/` to `scripts/`:

1. Rename to `.ts` if currently `.js`/`.cjs`
2. Add a top-of-file docstring explaining purpose + usage syntax
3. Ensure TypeScript strict-mode clean
4. Add a `package.json` script entry in `"scripts"` if it's for developer use
5. Run `npm run lint` and `npm run typecheck`
