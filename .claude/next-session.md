# Next-session notes (read at the start of every session)

Update this file at the end of each work session. Keep it short: what's pending, what to remember.
Session-note entries for `Session_log/` still go through Notes-manager TU (send a summary via SendMessage).

## Pending
- People page: styling pass is deferred (user said "fix the styling later"). Panel markup in `src/pages/people/index.astro` is not re-indented after the tab wrapper was added.
- Placeholder people data needs real facts from the department (via Notes-manager TU):
  - Nidhi Bhattacharya: email is `[PLACEHOLDER: email]`
  - Snigha Sharma: email `xyz@gmail.com` looks fake
  - Victoria (Research Assistant): no surname; researchArea empty
  - Narayan Sharma (Non-teaching): email empty
- Send Notes-manager TU a work summary for: people page tabs, `research_area` -> `researchArea` fix, removal of stray `src/content/config.ts`, `repo-scan` skill + session hooks.

## Remember
- Person photos go in `public/People-photos/`; the `photo` field is a filename relative to that folder.
- Schemas live in `src/content.config.ts` (note the dot). Astro silently drops frontmatter keys the schema doesn't list, so check field names (camelCase) if something doesn't show.
- After adding files to a previously empty content folder, restart `npm run dev` (stale dev server hides them).
- Plain HTML/CSS only, no Tailwind.
- `.claude/worktrees/` has old worktrees (ignored by git); prune with `git worktree prune` / `git worktree remove` when done with them.
