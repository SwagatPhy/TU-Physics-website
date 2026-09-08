# TU Website — Complete Editing Guide

This is a comprehensive guide for editing and maintaining the Department of Physics website. Whether you're adding content, creating new pages, or updating existing sections, this guide covers everything you need to know.

---

## 📁 Project Structure Overview

The project is built with **Astro**, a modern static site builder. Here's the complete directory structure:

```
TU-website/
├── src/                          # Source code (what you edit)
│   ├── pages/                    # Website pages (each .astro file = a page)
│   │   ├── index.astro          # Home page (/ route)
│   │   ├── academics/
│   │   │   ├── index.astro      # /academics page
│   │   │   ├── courses/
│   │   │   │   ├── index.astro  # /academics/courses list
│   │   │   │   └── [id].astro   # /academics/courses/:id (dynamic)
│   │   │   └── rules.astro      # /academics/rules
│   │   ├── admissions/
│   │   │   ├── index.astro      # /admissions overview
│   │   │   └── [id].astro       # /admissions/:id (doctoral/undergrad)
│   │   ├── news-events/
│   │   │   ├── index.astro      # /news-events list
│   │   │   └── [id].astro       # /news-events/:id (individual news/event)
│   │   └── ... (other pages)
│   │
│   ├── content/                  # Content collections (data, not visual)
│   │   ├── courses/              # Course markdown files
│   │   │   ├── phy-101.md       # Structured course data + body
│   │   │   └── ...
│   │   ├── admissions/           # Admission program files
│   │   │   ├── undergraduate.md
│   │   │   ├── postgraduate.md
│   │   │   └── doctoral.md
│   │   └── news-events/          # News and event files
│   │       ├── example-event.md
│   │       └── ...
│   │
│   ├── layouts/
│   │   └── Layout.astro          # Main page wrapper (header, footer, nav)
│   │
│   ├── styles/
│   │   └── global.css            # All website styling (plain CSS, no Tailwind)
│   │
│   ├── lib/
│   │   └── date.ts               # Utility functions for dates
│   │
│   └── content.config.ts         # Content collection schema definitions
│
├── public/                       # Static assets (images, favicons, etc.)
│   ├── favicon.ico
│   ├── favicon.svg
│   └── images/                   # Add images here (create if needed)
│
├── content-notes/                # Editorial notes (for content planning)
│   ├── home.md
│   ├── academics.md
│   ├── admissions.md
│   ├── news-events.md
│   └── ... (one per page)
│
├── Session_log/                  # Work logs
│   └── YYYY-MM-DD.md            # One file per calendar date
│
├── CLAUDE.md                     # Project instructions (read this!)
├── EDITING_GUIDE.md             # This file
├── package.json                  # Dependencies
├── astro.config.mjs             # Astro configuration
├── tsconfig.json                # TypeScript config
└── dist/                         # Built website (auto-generated, don't edit)
```

---

## 🌐 How Pages Work

### Static Pages (Simple Content)

**File**: `src/pages/about.astro`

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="About" description="Learn about our department.">
  <header class="page-header">
    <div class="container">
      <h1>About the Department</h1>
      <p>Introduction paragraph here...</p>
    </div>
  </header>

  <section class="section">
    <div class="container">
      <h2>Our Mission</h2>
      <p>Mission statement text here...</p>
    </div>
  </section>
</Layout>
```

**How it works:**
1. The `---` block at top is **frontmatter** (metadata)
2. `import Layout` brings in the page wrapper
3. `<Layout>` wraps your content, providing header/footer/nav
4. Everything inside `<Layout>` is the main content
5. `<div class="container">` centers content (see CSS)
6. Classes like `section` and `page-header` are styled in `global.css`

**To add a new static page:**
1. Create a new `.astro` file in `src/pages/`
2. Copy the structure above
3. Update the title and description
4. Add your HTML content inside the `<Layout>`
5. The page will automatically be accessible at `/filename`

---

## 📊 Content Collections (Dynamic Lists & Detail Pages)

Content collections let you store structured data that powers both list pages and detail pages. There are three collections:

### 1. **Courses** (for academic courses)

**Location:** `src/content/courses/` (markdown files)

**Schema** (required fields in each file):
```yaml
title: string         # Course name
code: string          # e.g., "PHY 101"
credits: number       # e.g., 4
level: string         # "undergraduate" or "postgraduate"
description: string   # One-line summary
```

**Example file:** `src/content/courses/phy-101.md`
```markdown
---
title: "Classical Mechanics"
code: "PHY 101"
credits: 4
level: "undergraduate"
description: "Newtonian mechanics, oscillations, and an introduction to Lagrangian methods."
---

This is the full course description (markdown format).

You can use **bold**, *italic*, lists, etc.

- Topics covered:
  - Kinematics
  - Newton's laws
  - Energy and momentum
```

**To add a course:**
1. Create a new markdown file in `src/content/courses/` (e.g., `phy-201.md`)
2. Copy the frontmatter structure above
3. Fill in all required fields
4. Add the course body content (detailed description)
5. Save and run `npm run dev` — the course appears immediately in `/academics/courses`

---

### 2. **Admissions** (for program information)

**Location:** `src/content/admissions/` 

**Schema:**
```yaml
title: string              # Program name
level: string              # "undergraduate" or "postgraduate" or "doctoral"
tagline: string            # Short catchline
duration: string           # e.g., "3 years", "2 years"
eligibility: array         # List of eligibility criteria
howToApply: array          # List of application steps
applicationDeadline: date  # e.g., "2026-12-31"
contactEmail: email        # e.g., "admissions@uni.edu"
order: number              # For sorting (1, 2, 3...)
```

**Example file:** `src/content/admissions/undergraduate.md`
```markdown
---
title: "Bachelor of Science in Physics"
level: "undergraduate"
tagline: "A rigorous 3-year program combining theory and experiment"
duration: "3 years"
eligibility:
  - "A-Level or equivalent in Mathematics and Physics"
  - "IELTS 6.5+ for international students (English medium)"
  - "Previous experience with laboratory work preferred"
howToApply:
  - "Submit UCAS application with required documents"
  - "Attend interview (typically in January-March)"
  - "Lab practical test for selected candidates"
  - "Final offer made in May"
applicationDeadline: "2027-01-15"
contactEmail: "admissions@uni.edu"
order: 1
---

Full program description here. Covers curriculum details, career prospects, etc.
```

**To add an admissions program:**
1. Create a file in `src/content/admissions/` with the program level name
2. Fill in all required schema fields
3. Add detailed description in the body
4. Pages appear at `/admissions` (list) and `/admissions/level-name` (detail)

---

### 3. **News & Events** (news and event announcements)

**Location:** `src/content/news-events/`

**Schema:**
```yaml
type: string        # "news" or "event"
title: string       # Headline
date: date          # "2026-12-25" format
summary: string     # Short description (for previews)
location: string    # (optional) For events only
draft: boolean      # Set to `true` to hide from site
```

**Example file:** `src/content/news-events/autumn-colloquium.md`
```markdown
---
type: "event"
title: "Autumn Colloquium: Quantum Computing Advances"
date: 2026-10-14
summary: "Join us for a talk on latest breakthroughs in quantum computing."
location: "Physics Lecture Hall A"
draft: false
---

On October 14, we'll host Dr. Jane Smith discussing recent advances in quantum error correction...

**Speakers:** Dr. Jane Smith (MIT), Prof. John Doe (Cambridge)

**Time:** 3:00 PM — 4:30 PM  
**Location:** Physics Lecture Hall A  
**Free entry, refreshments provided**
```

**To add news or events:**
1. Create a file in `src/content/news-events/` (filename becomes the URL slug)
2. Set type to "news" or "event"
3. Add date in YYYY-MM-DD format
4. Set draft: false to make it visible
5. Add body content (supports markdown: bold, italic, links, lists, etc.)
6. Items appear at `/news-events` (list) and `/news-events/slug-name` (detail)

---

## 🖼️ Images & Static Files

### Where to store files:

**Images and static assets → `public/` folder**

Any file in the `public/` folder is automatically copied to the built site and accessible at `/filename`.

**Directory structure:**
```
public/
├── favicon.ico           # Tab icon
├── favicon.svg           # Alternate tab icon
├── images/               # Create this folder for images
│   ├── hero-banner.jpg
│   ├── faculty/
│   │   ├── dr-smith.jpg
│   │   └── prof-jones.jpg
│   └── lab-photos/
│       ├── lab-01.jpg
│       └── lab-02.jpg
└── documents/
    └── course-syllabus.pdf
```

### How to use images in pages:

**In Astro files (`.astro` pages):**
```astro
<img src="/images/hero-banner.jpg" alt="Lab interior" />
```

**In markdown (content files):**
```markdown
![Lab interior](/images/lab-01.jpg)

*Caption: Our main laboratory*
```

**Key points:**
- All paths start with `/` (from the site root)
- Always include an `alt=""` attribute (for accessibility)
- Use descriptive names: `lab-interior.jpg` not `image1.jpg`
- Supported formats: JPG, PNG, GIF, SVG, WEBP
- Large images: consider optimizing before upload (aim for < 500 KB per image)

---

## 🎨 Styling & CSS

### Important: Plain CSS Only

This site uses **plain CSS** (no Tailwind, no CSS-in-JS). All styles are in:

**File:** `src/styles/global.css`

### Design Tokens (Colors, Spacing, Fonts)

At the top of `global.css`, you'll find the design tokens:

```css
:root {
  --color-bg: #ffffff;              /* Background */
  --color-text: #1f2937;            /* Main text */
  --color-text-muted: #55606e;      /* Lighter text */
  --color-accent: #1e3a5f;          /* Primary color */
  --color-accent-hover: #16293f;    /* Hover state */
  --color-border: #dfe3e8;          /* Borders */
  --color-surface: #f7f8fa;         /* Light backgrounds */

  --font-serif: Georgia, 'Times New Roman', Times, serif;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

  --max-width: 72rem;               /* Container max width */
  --space-sm: 0.75rem;              /* Small spacing */
  --space-md: 1.5rem;               /* Medium spacing */
  --space-lg: 3rem;                 /* Large spacing */
  --space-xl: 5rem;                 /* Extra large spacing */
}
```

**To change colors globally:** Update these token values.

**To change spacing:** Adjust the `--space-*` values.

### Adding New Styles

Add CSS classes to `global.css`:

```css
.my-custom-class {
  padding: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
```

Then use the class in your HTML:

```astro
<div class="my-custom-class">
  Content here
</div>
```

### Existing Utility Classes

The CSS file defines these reusable classes:

- `.container` — Centered max-width container (use to wrap all content)
- `.section` — Full-width section with padding
- `.page-header` — Page title area with background
- `.card` — Clickable card (for lists)
- `.card-grid` — Grid of cards
- `.back-link` — Link that looks like a navigation button
- `.badge` — Inline label (for metadata)
- `.detail-header` — Header for detail pages
- `.detail-body` — Content area for detail pages

**Example:**
```astro
<section class="section">
  <div class="container">
    <h2>Section Title</h2>
    <ul class="card-grid">
      <li>
        <a class="card" href="/page">
          <h3>Card Title</h3>
          <p>Description</p>
        </a>
      </li>
    </ul>
  </div>
</section>
```

---

## 🚀 Common Editing Tasks

### Task 1: Update Text on an Existing Page

**Example: Update the About page intro**

1. Open `src/pages/about.astro`
2. Find the text you want to change
3. Edit it directly
4. Save the file
5. The change appears immediately when running `npm run dev`

### Task 2: Add a New Course

1. Create `src/content/courses/new-course-code.md`
2. Add this content:
```markdown
---
title: "Course Title"
code: "PHY XXX"
credits: 4
level: "undergraduate"
description: "One-line summary of what the course covers."
---

Full course description here. You can explain:
- Prerequisites
- Topics covered
- Assessment methods
- etc.
```
3. Save
4. The course automatically appears in `/academics/courses`

### Task 3: Add a News Item

1. Create `src/content/news-events/my-news-title.md`
2. Add this content:
```markdown
---
type: "news"
title: "News Headline"
date: 2026-12-25
summary: "Short version for list preview"
draft: false
---

Full news article here. Supports **bold**, *italic*, lists, etc.
```
3. Save
4. Appears at `/news-events`

### Task 4: Add an Image to a Page

1. Save your image to `public/images/filename.jpg`
2. In your `.astro` file, add:
```astro
<img src="/images/filename.jpg" alt="Description of image" />
```
3. Save and view in browser

### Task 5: Change Colors/Styling

1. Open `src/styles/global.css`
2. Find the `:root` section at the top
3. Change color values:
```css
:root {
  --color-accent: #1e3a5f;  /* Change this to your new color */
}
```
4. Save — all elements using `--color-accent` update immediately

### Task 6: Create a Completely New Page

**Example: Add an `/about` page**

1. Create `src/pages/about.astro`
2. Add this template:
```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="About" description="About the department">
  <header class="page-header">
    <div class="container">
      <h1>About Us</h1>
    </div>
  </header>

  <section class="section">
    <div class="container">
      <h2>Our Story</h2>
      <p>Your content here...</p>
    </section>
  </section>
</Layout>
```
3. Save
4. Page is live at `/about`
5. Add navigation link in `src/layouts/Layout.astro` (see the `navLinks` array)

---

## 🔄 How Pages Are Generated

### Static Pages Flow:
```
Edit src/pages/about.astro
              ↓
    Astro finds the file
              ↓
    Renders HTML using Layout
              ↓
    Page available at /about
```

### Content Collection Flow:
```
Add src/content/courses/phy-101.md
              ↓
    Astro reads the file & schema
              ↓
    Data available to both:
    - /academics/courses (list page)
    - /academics/courses/phy-101 (detail page)
              ↓
    getCollection('courses') fetches all
              ↓
    Template renders with the data
```

---

## 📝 Markdown Reference (for content files)

All content collection files use **markdown**. Here's the syntax:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
~~Strikethrough~~

[Link text](https://example.com)

- Bullet point 1
- Bullet point 2
  - Nested item
  - Another nested

1. Numbered item
2. Another item

> Blockquote text

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |

![Image alt](/images/photo.jpg)

`inline code`

\`\`\`
Code block
\`\`\`
```

---

## ⚙️ Running & Testing Locally

### Start the development server:
```bash
npm run dev
```
Then open http://localhost:3000 in your browser

### Build for production:
```bash
npm run build
```

### Preview the production build:
```bash
npm run preview
```

---

## 🚨 Common Mistakes to Avoid

| Mistake | Solution |
|---------|----------|
| Broken image link | Check the path starts with `/` and file is in `public/` |
| Page not appearing | Make sure file is in `src/pages/` and has `.astro` extension |
| Content missing | Check file is in `src/content/courses/` (or admissions/news-events) |
| Typo in schema | Look at the `.md` file's frontmatter — must match `content.config.ts` exactly |
| Layout broken | Ensure you imported Layout and wrapped content in `<Layout>` tags |
| Styles not applying | Check class names match `global.css` exactly |

---

## 📋 Checklist for Adding New Content

- [ ] File created in correct location (`src/pages/`, `src/content/`, etc.)
- [ ] All required schema fields filled in (title, date, etc.)
- [ ] No typos in field names (must match schema exactly)
- [ ] Images have alt text and correct paths
- [ ] Links use correct relative paths (`/about`, not `./about`)
- [ ] Files are saved (check editor shows no unsaved indicator)
- [ ] Run `npm run dev` and test in browser
- [ ] Check on mobile and desktop sizes

---

## ❓ Quick Reference

| Task | File to Edit |
|------|--------------|
| Change site logo/header | `src/layouts/Layout.astro` |
| Update navigation menu | `src/layouts/Layout.astro` (navLinks array) |
| Add/edit course | `src/content/courses/*.md` |
| Add/edit news or event | `src/content/news-events/*.md` |
| Add/edit admissions program | `src/content/admissions/*.md` |
| Change colors | `src/styles/global.css` (top section) |
| Add new static page | `src/pages/newpage.astro` |
| Add image | Save to `public/images/`, use `<img src="/images/file.jpg">` |
| Change footer text | `src/layouts/Layout.astro` |
| Add new CSS class | Add to `src/styles/global.css` |

---

## 🆘 Getting Help

- **Astro docs:** https://docs.astro.build
- **Markdown guide:** https://www.markdownguide.org
- **CSS reference:** https://developer.mozilla.org/en-US/docs/Web/CSS

Good luck! The site is yours to edit. 🚀
