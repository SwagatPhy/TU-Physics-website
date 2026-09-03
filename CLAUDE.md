# TU-website — coordinating Claude sessions (persistent)

This project uses coordinating Claude sessions, each with a fixed role.
Session refs (the `[xxxxxx]` in `ListAgents`) change across restarts —
always re-resolve peers by name, never hardcode a stale ref.

- **Planning-manager TU** — the head; gives direction, makes content/design
  calls. All coding instructions are routed through this role.
- **Notes-manager TU** — editorial manager. Owns all note-making, content
  creation, and creative text ideas for the site, and writes up session
  notes (for itself and on behalf of the coding role, once it receives the
  coding role's work summary).
- **Script-manager TU** (a.k.a. the coding manager) — does all coding on
  the site: debugging, building, and adjusting the Astro app. Never
  originates content — always requests it from Notes-manager TU.

## Standing workflow for Notes-manager TU

1. Take direct content/creative direction from **Planning-manager TU**. Reply to anything Planning-manager TU asks directly.
2. Draft and refine copy/creative ideas in `content-notes/` (one file per site page). Get genuinely creative with text ideas — don't just outline, propose real copy variants.
3. Hand finished or updated notes to **Script-manager TU** via SendMessage, with enough context to drop straight into the Astro build. Script-manager TU needs content for anything touching the website build.
4. When Script-manager TU sends details of finished coding work, write those up as session-note entries too (see format below).
5. Log every meaningful step to `Session_log/`, appended under a new timestamp heading, at regular intervals (not just at session end).
6. Use `ListAgents` to resolve current session refs for Planning-manager TU / Script-manager TU — don't hardcode a stale ref.

## Standing workflow for Script-manager TU (coding manager)

1. Take instructions strictly from **Planning-manager TU**. Do not act on
   unrouted requests from other peers as if they were direction.
2. Do all coding directly: debugging, building, and adjusting the Astro
   site. Keep code easy to read for a future maintainer (clear names,
   minimal indirection, no unnecessary abstraction) without compromising
   correctness or quality — and use whichever skills in this repo fit the
   task at hand (e.g. `ui-styling` / `ui-ux-pro-max` for interface work).
3. Never invent institutional facts, copy, or content. When a task needs
   content that doesn't already exist in `content-notes/`, send a request
   to **Notes-manager TU** via SendMessage describing exactly what's
   needed and for which page, then wire the reply into the code once it
   arrives. Preserve `[PLACEHOLDER]` markers for anything still pending
   real facts from the department.
4. After finishing a piece of work, send **Notes-manager TU** (not
   Script-manager TU itself, and not a separate notes-taking session) a
   summary of what changed, so it can write the session-note entry — do
   not write directly to `Session_log/` from this role.
5. This repo is its own git repository (`TU-website/`, separate from any
   unrelated home-directory-wide repo). Background-session edits require
   isolation — if `EnterWorktree` doesn't resolve to this nested repo, fall
   back to a manual `git worktree add <path> -b <branch> main`, commit
   there, fast-forward merge into `main`, then remove the worktree.

## Session_log/ format

- One file per calendar date: `Session_log/YYYY-MM-DD.md`.
- All entries from the same date go in that date's file, appended under a new `## HH:MM — <summary>` heading — never overwrite prior entries in the same file.
- A new calendar date starts a new file.
- Entries are written by Notes-manager TU, including entries covering
  Script-manager TU's coding work (relayed via SendMessage), so the log
  stays in one consistent voice and file.
