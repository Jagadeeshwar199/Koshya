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

## Mandatory final step (every task, same commit as code)
1. Review what changed (bug fix, rule, architecture, tests).
2. Update if needed: `BUG_HISTORY.md`, `AI_RULES.md`, `ARCHITECTURE.md`, `TESTING_RULES.md`.
3. Minimal edits only; no speculative content.
4. If nothing new: note in commit or skip doc diff.

## Deploy
```bash
git push origin main   # triggers Railway deploy workflow
```
