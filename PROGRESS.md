# Progress Log

Append-only session log. Update **after every finalized function** before opening a PR.

---

## How to use this file

- Read this file at the **start of every session** to know where things stand.
- Add a new entry **after every finalized function**, using the template below.
- Fill in the commit SHA and PR URL after pushing.
- Never delete entries. Never rewrite history here.
- If you discover a mistake in a past entry, append a correction entry instead of editing the original.

## Entry template

```markdown
## [YYYY-MM-DD HH:MM] <Feature / Function Name>

**Phase:** <Phase 1–6 from CLAUDE.md>
**Scope:** <one-line description>
**Files touched:** <list>
**Tests:** <added / updated / N-A>
**Migration:** <yes/no — name if yes>
**Notes:** <gotchas, follow-ups, decisions made>
**Commit:** <sha>
**PR:** <url>
```

## Session-start commands

Before doing anything else in a working session:

```bash
# In WSL2, from the repo root
pnpm dev:up
# verify
curl http://localhost:4000/api/v1/health
curl http://localhost:3000
```

End of session:

```bash
pnpm dev:down
```

---

## Log

<!-- New entries get appended below this line, newest at the bottom. -->

## [TBD] Project bootstrap

**Phase:** Pre-Phase-1
**Scope:** Initial monorepo scaffold — empty.
**Files touched:** CLAUDE.md, PROGRESS.md, PRICING.md, PERMISSIONS.md, SCHEMA.md
**Tests:** N/A
**Migration:** N/A
**Notes:** Specs written; code not yet started. First real entry should be Phase 1 — Foundation (auth + users + roles + branches + system parameters scaffolding).
**Commit:** —
**PR:** —
