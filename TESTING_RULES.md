# Testing Rules — Koshya

## Required
1. **Every bug fix** includes a test (new or extended file under `tests/`).
2. **No regressions** — run full suite before push.
3. **Regression tests** for reported user flows (multi-turn, typos, timezone).

## Commands
```bash
npm test              # all suites via tests/run-all.js
npm run test:parser   # parser only
npm run test:subscription-pending
```

## Conventions
- Tests are plain Node `assert`; no Jest.
- Set dummy `SUPABASE_URL` / keys in test files when importing services.
- Prefer testing **parser + intent** without DB when possible.
- Router/integration tests mock or env-guard Supabase.

## Before merge
- `npm test` → all suites pass.
- Add suite to `tests/run-all.js` and `package.json` scripts if new file.

## Do not
- Skip tests for “small” fixes.
- Break existing assertions without explicit product change + doc update.
