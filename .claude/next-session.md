# Next-session notes (read at the start of every session)

Update this file at the end of each work session. Keep it short: what's pending, what to remember.
Session-note entries for `Session_log/` still go through Notes-manager TU (send a summary via SendMessage).

## Pending
- Full-site redesign (2026-09-30) is merged. Content still needed from the department (requested via Notes-manager TU):
  - Captions for the 54 lab photos in `public/Facilities-photos/Facilities/` (currently "Laboratory equipment, photo N")
  - Observatory description, Facilities intro, lab list (Facilities page placeholders)
  - Contact page: building, PIN, phone, email, office contacts, directions
  - Academic rules (all four sections are [PLACEHOLDER])
  - Research (now 7 areas, ordered by the `order` field): copy for Soft Matter & Interfacial, Neutrino & Astroparticle, Cosmology, Nonlinear Dynamics (all [PLACEHOLDER]); faculty lists for every area (Astronomy and Condensed Matter still carry the same three copy-pasted faculty); reused body text for Astronomy, Condensed Matter/Material Science and High Energy Physics is unverified starter copy
  - Several faculty/scholars list research interests outside the 7 areas (plasma, photonics/optics, microwave/antennas, geophysics…) — list sent to Notes-manager TU 2026-09-30
- Placeholder people data needs real facts:
  - Nidhi Bhattacharya: email is `[PLACEHOLDER: email]`
  - Snigha Sharma: email `xyz@gmail.com` looks fake
  - Jayanta Kumar Sarma and Dambarudhar Mohanta share the email `jks@tezu.ernet.in`
  - Victoria (Research Assistant): no surname; uses `researchArea` key, schema expects `research_area`
  - Narayan Sharma (Non-teaching): email empty
- Visitor counter on the home page needs a data source: set `VISITOR_COUNTER_URL` in `src/pages/index.astro` (expects JSON `{"count": n}`).

## Remember
- Design tokens (DESIGN.md palette) live at the top of `src/styles/global.css`; pages use semantic `--color-*` tokens. Run `node scripts/contrast-check.js` after palette changes.
- Shared components: `src/components/` (Icon, PageHeader, PersonCard, PhotoGallery, AdmissionsAudience).
- Research-area images: pages use resized copies in `public/Research-areas/web/` (see `src/lib/images.ts`). Add a web copy when adding an image.
- Facilities gallery lists every image in `public/Facilities-photos/Facilities/` automatically.
- Person photos go in `public/People-photos/`; the `photo` field is a filename relative to that folder. Without a photo, cards show initials.
- Schemas live in `src/content.config.ts` (note the dot). Astro silently drops frontmatter keys the schema doesn't list — scholars/assistants use `research_area`.
- After adding files to a previously empty content folder, restart `npm run dev` (stale dev server hides them).
- Plain HTML/CSS only, no Tailwind.
- `.claude/worktrees/` has old worktrees (ignored by git); prune with `git worktree prune` / `git worktree remove` when done with them.
