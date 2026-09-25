---
name: repo-scan
description: Walk through the TU-website repo to rebuild context after a /clear. Reports git state, pages, content collections, and gaps (empty folders, [PLACEHOLDER] markers, stray files). Use at the start of a session or when asked to "scan the repo".
---

# repo-scan

Read-only orientation pass. Do not edit anything. Keep the final report short.

1. **Instructions**: re-read `CLAUDE.md`, the memory index (`MEMORY.md`), and `.claude/next-session.md` (pending items and things to remember).
2. **Git state**: `git status --short`, `git log --oneline -5`, `git worktree list`.
3. **Pages**: list `src/pages/**` and `src/layouts/**`; note anything new or modified.
4. **Content collections**: read `src/content.config.ts`. Confirm every collection's folder in `src/content/` exists, and count the `.md` files in each. Flag empty folders.
5. **Stray files**: flag anything Astro won't read (e.g. a second `src/content/config.ts` next to `src/content.config.ts`).
6. **Pending content**: `grep -rn "PLACEHOLDER" src content-notes` and count per file.
7. **Notes and logs**: list `content-notes/` and the latest `Session_log/` file; note the last entry heading.
8. **Peers**: `ListAgents` to resolve current Planning-manager, Notes-manager and Script-manager refs (never reuse old refs).

## Report format

- One line each: branch/uncommitted changes, pages touched, collections with counts.
- **Gaps**: empty folders, placeholders, stray files.
- **From next-session.md**: anything still pending.
- **Next step**: the single most likely thing to work on, based on the above.
