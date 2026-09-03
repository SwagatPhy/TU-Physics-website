# Content Notes — Department of Physics, Tezpur University Website

This directory holds **content drafts** for the Department of Physics website at Tezpur
University (a public/central university in Assam, India), built in parallel by a separate agent
scaffolding the Astro site structure. Nothing here is real institutional fact — every specific
name, number, date, or claim is a clearly marked `[PLACEHOLDER]` meant to give the site real page
structure and realistic-looking copy without fabricating facts about the actual department.
Treat these files as fill-in-the-blank drafts for a human to replace with verified content, not as
source-of-truth data.

The department is framed as a **teaching + research university department** (not a pure research
institute) — pages reflect that: UG/PG/PhD programs and courses sit alongside research and
faculty content.

## What's drafted

| File | Page | Status |
|---|---|---|
| `home.md` | Home / Landing | Outline + placeholder copy + open questions |
| `about.md` | About the Department | Outline + placeholder copy + open questions |
| `faculty.md` | Faculty (directory + profile template) | Outline + placeholder copy + open questions |
| `research.md` | Research Areas / Groups | Outline + placeholder copy + open questions |
| `academics.md` | Academics (UG/PG/PhD programs, courses, admissions) | Outline + placeholder copy + open questions |
| `publications.md` | Publications | Outline + placeholder copy + open questions |
| `facilities.md` | Facilities / Labs | Outline + placeholder copy + open questions |
| `news-events.md` | Notices & Events | Outline + placeholder copy + open questions |
| `contact.md` | Contact / Location | Outline + placeholder copy + open questions |

Each file follows the same pattern:
1. **Recommended outline** — sections and data fields the page type typically needs.
2. **Placeholder copy** — draft text/markup marked `[PLACEHOLDER — ...]`, safe to drop into the
   scaffolded site so pages aren't empty during development.
3. **Open questions** — what real information/decisions are needed from the user before this
   page can go live.

## Master list of information needed from the user

This consolidates the "Open questions" from every page. Roughly grouped by theme:

**Identity & branding**
- Confirmation of exact official name/style: "Department of Physics, Tezpur University" — any
  preferred short form or existing department logo/branding?
- Approved tagline/mission statement (or should one be drafted for sign-off?).
- Any existing style guide or brand assets (may already be with the script agent, but flagging in
  case content needs to match tone).

**Institutional facts**
- Founding year of the department and which School/Faculty of Tezpur University it belongs to.
- Real headline stats: faculty count, research scholar count, number of research groups/labs.
- Institutional history/timeline and notable milestones.
- Current Head of Department name + approved public bio.
- Accreditation details (NAAC grade, UGC recognition) if the department wants these displayed.
- Formal affiliations, MOUs, and collaborating institutions.
- Exact campus building/block/room for the department, and PIN code/directions info.
- Department contact phone/email, and role-specific contacts (HoD, admissions coordinator,
  office staff).
- Social media handles, if the department maintains its own (vs. relying on the university's).

**People**
- Complete faculty roster: names, correct titles/designations, current status (regular / emeritus
  / visiting / on leave).
- Professional headshots for each faculty member (with usage permission).
- Verified research interests and bios per faculty member (self-written preferred).
- Official email format (e.g. name@tezu.ac.in) and whether individual emails should be public.
- Preferred external profile links per person (Google Scholar, ORCID, ResearchGate, personal site).
- Whether/how to include emeritus, visiting faculty, PhD scholars, and technical/support staff.
- Courses each faculty member currently teaches (for cross-linking with Academics).

**Research**
- Official list of research groups/areas (names + scope, as defined internally by the department).
- Mapping of which faculty belong to which research area.
- Key labs/equipment associated with each area (cross-link with Facilities).
- Major sponsored/funded research projects and their funding agencies (UGC, DST, SERB, CSIR, etc.).
- Any formal collaborations (other TU departments, other universities, national labs).

**Academics**
- Exact program list: does the department run its own B.Sc., or is Physics offered as a subject
  within a broader B.Sc.? Confirm M.Sc. and Ph.D. offerings, and any certificate/diploma courses.
- Real eligibility criteria and entrance exam names (Tezpur University's own PG/PhD entrance tests,
  if applicable).
- Current admissions cycle timeline/dates and seat intake per program.
- Accurate fee structure or a link to the official fee page.
- Accurate fellowship/stipend figures and funding sources for PhD scholars.
- Link to the real Tezpur University admissions portal.
- Whether a full course catalog is needed, and the real course list/codes/syllabi (or links to
  official syllabus PDFs).
- Academic calendar dates and admissions contact (departmental or central admissions cell).

**Publications**
- Source of truth for publication data (faculty CVs, Google Scholar profiles, institutional
  repository?).
- Per-faculty vs. department-wide listing (or both).
- Date range to display / how far back to backfill.
- DOI/arXiv link availability for automated linking vs. manual entry.
- Preferred citation style.
- Whether books, book chapters, or patents should be listed.

**Facilities / Labs**
- Real list of teaching labs and what courses/experiments they support.
- Real list of research labs: names, faculty in charge, major equipment.
- Whether a detailed equipment inventory should be published or just high-level descriptions.
- Photos of labs/facilities (with permission to publish).
- Any usage policy for external researchers/collaborators.

**Notices & Events**
- Any existing notice archive to migrate (past circulars, admission/exam notices).
- Real upcoming events/seminar schedule, or a calendar feed to embed.
- Naming of any regular seminar/colloquium series and its organizer.
- Whether notices should link to/embed the central Tezpur University notice board, or be
  maintained independently by the department.
- Who owns ongoing content updates (determines whether a simple static list suffices or a
  lightweight CMS/admin panel is warranted).

**Process / ownership**
- Who is the point of contact for fact-checking each page before launch?
- Any existing official documents (department brochure, university handbook, prospectus) that
  should seed real copy instead of drafting from scratch?

## How to use these notes

- Treat placeholder copy as **structural filler only** — safe for the script agent to wire into
  templates/layouts, but every `[PLACEHOLDER ...]` must be replaced with verified content before
  the site is considered launch-ready.
- When real content arrives, update the corresponding file in this directory first, then hand off
  to the script agent (or directly edit the Astro content collections) to sync.
