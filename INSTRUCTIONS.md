# TU-Website — Team Instructions & Workflows

**Last Updated:** September 4, 2026  
**For:** Planning-manager TU, Notes-manager TU, Script-manager TU

---

## 🎯 Quick Start

### Development Workflow
```bash
# Start dev server
npm run dev --background

# Make changes (edit files)
# Server auto-reloads at localhost:4321

# Test your changes
# Visit localhost:4321 in browser

# Build & verify
npm run build

# Commit your changes
git add <files>
git commit -m "..."
```

---

## 📝 For Notes-manager TU

### Task: Add/Update Content

#### **Research Areas**
**File:** `src/content/research/*.md`

**Template:**
```markdown
---
specialization: "Research Area Name"
faculty: "Dr. Name, Dr. Name"
description: "One sentence describing what this group researches"
contact: "Dr. Primary Contact"
email: "contact@tu.edu"
---

## Overview
Detailed description of the research group.

## Research Focus
- Topic 1
- Topic 2
- Topic 3

## Current Projects
- Project 1
- Project 2

## Facilities
- Equipment 1
- Equipment 2
```

**Steps to Add New Research Area:**
1. Create new file: `src/content/research/my-specialization.md`
2. Fill in frontmatter (specialization, faculty, description, contact, email)
3. Write markdown content
4. Save and run `npm run build`
5. Check `/research/my-specialization` renders correctly

#### **News & Events**
**File:** `src/content/news-events/*.md`

**Schema:**
```markdown
---
type: "news" OR "event"
title: "Headline"
date: 2026-09-04
summary: "One sentence summary"
location: "Building/Room" (optional, for events)
draft: false
---

Additional details or article body.
```

**Steps to Add News:**
1. Create: `src/content/news-events/my-news-item.md`
2. Set `type: "news"`
3. Fill in date, title, summary
4. Save and build — appears on homepage automatically

**Steps to Add Event:**
1. Create: `src/content/news-events/my-event.md`
2. Set `type: "event"`
3. Fill in date, title, summary, location
4. Save and build — appears on homepage automatically

---

## 💻 For Script-manager TU

### Task: Modify Layouts & Templates

#### **Understanding Page Structure**

```
src/pages/
├── index.astro          ← Homepage
├── research/
│   ├── index.astro      ← Research list page
│   └── [id].astro       ← Research detail pages
├── academics/
│   ├── index.astro
│   └── courses/
│       └── [id].astro
└── ... (other page folders)
```

**Pattern:**
- `index.astro` = List page showing all items
- `[id].astro` = Detail page for single item

#### **How to Add a New Page Section to Homepage**

**File:** `src/pages/index.astro`

**Steps:**

1. **Add data fetching** (at top, in frontmatter):
```astro
---
const myData = await getCollection('my-collection');
---
```

2. **Add HTML section**:
```astro
<section class="section my-section">
  <div class="container">
    <h2>Section Title</h2>
    {myData.map(item => (
      <article>
        <h3>{item.data.title}</h3>
        <p>{item.data.description}</p>
      </article>
    ))}
  </div>
</section>
```

3. **Add CSS** (in `<style>` block):
```css
.my-section {
  background: white;
  padding: var(--space-lg);
}
```

4. **Test:**
```bash
npm run dev
# Visit localhost:4321
# Verify section appears
```

#### **How to Modify Research Card Layout**

**File:** `src/pages/research/index.astro` (list) or `[id].astro` (detail)

**Example — Make Cards Show Different Data:**

In `index.astro`, modify the card display:
```astro
{levels.map(item => (
  <a href={`/research/${item.id}`} class="card">
    <h3 class="card-title">{item.data.specialization}</h3>
    <p>{item.data.faculty}</p>
    <!-- Add more data fields here -->
  </a>
))}
```

Access these fields from frontmatter:
- `item.data.specialization`
- `item.data.faculty`
- `item.data.description`
- `item.data.contact`
- `item.data.email`

#### **How to Style an Element**

**CSS Classes Hierarchy:**

1. **Use existing global classes first** (from `src/styles/global.css`):
   - `.card`, `.card-grid`, `.card-title`, `.card-summary`
   - `.section`, `.container`
   - `.badge`, `.detail-header`, `.detail-body`

2. **If you need custom styling, add to `<style>` block**:
```astro
<style>
  .my-custom-class {
    color: var(--color-accent);
    padding: var(--space-md);
    border: 1px solid var(--color-border);
  }
</style>
```

3. **Always use CSS tokens**:
   ```css
   color: var(--color-text)           /* Main text */
   color: var(--color-text-muted)     /* Muted text */
   background: var(--color-surface)   /* Light background */
   border: 1px solid var(--color-border)
   color: var(--color-accent)         /* Blue accent */
   ```

#### **Common Modifications**

**Change homepage intro text:**
→ Edit `src/pages/index.astro`, find `.mission` section, update paragraph

**Change research section title:**
→ Edit `src/pages/research/index.astro`, line ~11

**Add new program (e.g., Certificate):**
→ Edit `src/pages/index.astro`, `.programs-grid` section, add another `.program-card`

**Change button colors:**
→ Edit `src/pages/index.astro`, `.cta-button` CSS

---

## 🎨 For Planning-manager TU

### Task: Design Direction & Content Approval

#### **1. Review Checklist**

Before approving changes:

- [ ] Content is accurate (research areas, faculty, dates)
- [ ] Typography is readable (font sizes, colors)
- [ ] Spacing looks balanced (padding, margins, gaps)
- [ ] Colors match brand (blue accent #1e3a5f, backgrounds)
- [ ] Mobile layout works (no horizontal scroll)
- [ ] Links all work (hover states clear)
- [ ] Homepage represents department well

#### **2. Test Changes Locally**

```bash
# Start dev server
npm run dev

# Open browser
# Visit http://localhost:4321

# Check:
# - Click all links
# - Hover on cards and buttons
# - Resize browser (mobile, tablet, desktop)
# - Check /research, /academics, /admissions pages
```

#### **3. Common Decisions You'll Make**

**Q: Should we show all research areas or just preview?**
→ Currently: Preview first 3 on homepage, full list on `/research`

**Q: What order should sections appear in?**
→ Currently: Hero → Highlights → Mission → Programs → Research → News/Events → CTA

**Q: Should cards have images?**
→ Currently: No images (text-only cards). Can add if department provides images.

**Q: What should the hero background be?**
→ Currently: Gradient blue. Alternative: Photo of campus/building

**Q: How many news/events items on homepage?**
→ Currently: 3 each. Configurable in `src/pages/index.astro` (change `.slice(0, 3)`)

---

## 🛠️ Technical Reference

### File Locations

| Purpose | File |
|---------|------|
| Homepage | `src/pages/index.astro` |
| Research list | `src/pages/research/index.astro` |
| Research detail template | `src/pages/research/[id].astro` |
| Research content | `src/content/research/*.md` |
| News/events content | `src/content/news-events/*.md` |
| Global CSS | `src/styles/global.css` |
| Main layout | `src/layouts/Layout.astro` |
| Content schema | `src/content.config.ts` |
| Config | `astro.config.mjs`, `tsconfig.json` |

### CSS Token Reference

```css
/* Colors */
--color-bg: #ffffff                 /* Page background */
--color-text: #1f2937               /* Main text */
--color-text-muted: #55606e         /* Secondary text */
--color-accent: #1e3a5f             /* Blue, used for highlights */
--color-surface: #f7f8fa            /* Light gray backgrounds */
--color-border: #dfe3e8             /* Border/divider color */

/* Fonts */
--font-serif: Georgia, serif        /* Headings */
--font-sans: system fonts           /* Body text */

/* Spacing */
--space-sm: 0.75rem
--space-md: 1.5rem
--space-lg: 3rem
--space-xl: 5rem

/* Layout */
--max-width: 72rem                  /* Container width */
```

### Astro Cheat Sheet

```astro
<!-- Get all items from a collection -->
const items = await getCollection('research');

<!-- Loop and display -->
{items.map(item => (
  <div>
    {item.data.title}
    {item.data.description}
  </div>
))}

<!-- Render markdown body -->
const { Content } = await render(item);
<Content />

<!-- Dynamic routes (for [id].astro) -->
export async function getStaticPaths() {
  const items = await getCollection('research');
  return items.map(item => ({
    params: { id: item.id },
    props: { item }
  }));
}
```

---

## 📋 Common Tasks

### Task: Update Department Stats
**File:** `src/pages/index.astro` (line ~40-55)
```astro
<div class="highlight-number">20+</div>  <!-- Change here -->
<div class="highlight-label">Faculty Members</div>
```

### Task: Change Hero Tagline
**File:** `src/pages/index.astro` (line ~25)
```astro
<p class="hero-tagline">Your New Tagline Here</p>
```

### Task: Add Research Area
**File:** Create `src/content/research/new-area.md`
Then homepage automatically shows it in preview, and `/research/new-area` is live

### Task: Update Mission Statement
**File:** `src/pages/index.astro` (line ~61-69)
```astro
<p class="mission-text">
  Your new mission statement here...
</p>
```

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

Output: `dist/` folder with all static HTML files

### Verify Build
```bash
npm run build
# Check dist/ folder for all pages
# Should have: index.html, research/index.html, research/*/index.html, etc.
```

---

## ❓ Troubleshooting

### Changes not showing?
```bash
# Stop dev server (Ctrl+C)
npm run dev
# Reload browser (Cmd+Shift+R for hard refresh)
```

### Build errors?
```bash
npm run build
# Read error message carefully
# Check file syntax (quotes, braces, tags)
```

### Content not appearing?
1. Check file is in right folder (`src/content/research/` or `src/content/news-events/`)
2. Check filename matches collection name
3. Check frontmatter is valid YAML (proper indentation)
4. Run `npm run build` to verify

### CSS not working?
1. Check class name matches (case-sensitive)
2. Verify `var(--color-*)` tokens exist in global.css
3. Check specificity (more specific selectors override)
4. Check `<style>` is inside `.astro` file (not separate CSS file)

---

## 📞 Role-Specific Contacts

**If you need to:**
- **Add/update content** → Contact Notes-manager TU
- **Modify layout/styling** → Contact Script-manager TU  
- **Approve changes** → Planning-manager TU decides

**Git workflow:**
1. Make changes
2. Test locally
3. Commit with clear message
4. Build verifies success

---

## ✅ Quality Standards

- All pages must build without errors
- No broken links
- Mobile responsive (test at all breakpoints)
- Consistent spacing and typography
- Use existing CSS tokens (don't invent new colors)
- Clear commit messages
- No unnecessary abstractions

---

**Version:** 1.0  
**Status:** ACTIVE  
**Last reviewed:** Sept 4, 2026
