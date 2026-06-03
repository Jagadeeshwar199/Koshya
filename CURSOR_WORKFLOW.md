# Cursor Workflow — Koshya

## Before any code change
1. Read `AI_RULES.md`
2. Read `ARCHITECTURE.md`
3. Read `BUG_HISTORY.md` (check for prior fix)

## During change
1. Reproduce / identify **root cause** (logs, `parseMessage`, intent).
2. **Minimal diff** — no unrelated refactors.
3. Add or update tests per `TESTING_RULES.md`.
4. Run `npm test`.

## After change
- Update `BUG_HISTORY.md` row if user-reported bug fixed.
- Update `AI_RULES.md` / `ARCHITECTURE.md` only if behavior or structure changed.

## Deploy
```bash
git push origin main   # triggers Railway deploy workflow
```
