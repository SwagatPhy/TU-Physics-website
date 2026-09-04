# Guide: Adding Images & Slideshow to Research Pages

**Purpose:** Display images for each research specialization on both research detail pages and homepage  
**Difficulty:** Intermediate  
**Time:** 30 minutes to set up, then 5 minutes per research area to add images

---

## 📋 Step-by-Step Implementation

### **Step 1: Update Research Schema**

**File:** `src/content.config.ts`

Add an image field to the research schema:

```typescript
const research = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/research'}),
    schema: z.object({
        specialization: z.string(),
        faculty: z.string(),
        description: z.string(),
        contact: z.string(),
        email: z.string(),
        image: z.string().optional(),              // ← ADD THIS LINE
        imageAlt: z.string().optional(),           // ← ADD THIS LINE
    })
});
```

**Explanation:**
- `image`: Path to the image file (e.g., `/images/research/condensed-matter.jpg`)
- `imageAlt`: Alt text for accessibility

---

### **Step 2: Create Images Directory**

Create folder structure for research images:

```bash
mkdir -p public/images/research
```

**Folder structure:**
```
public/
└── images/
    └── research/
        ├── condensed-matter.jpg
        ├── optics-photonics.jpg
        ├── nuclear-particle.jpg
        ├── materials-science.jpg
        ├── astrophysics.jpg
        └── theoretical-physics.jpg
```

**Why `public/`?**
- Astro copies everything in `public/` to the build output
- Images are accessible at `/images/research/filename.jpg` in the browser
- Don't use `src/` for images (Astro processes them differently)

---

### **Step 3: Update Research Markdown Files**

Add image references to each research area.

**Example:** `src/content/research/condensed-matter.md`

```markdown
---
specialization: "Condensed Matter Physics"
faculty: "Dr. Rajesh Kumar, Dr. Priya Singh"
description: "Studies the physical properties of materials using theoretical modeling and experimental techniques"
contact: "Dr. Rajesh Kumar"
email: "rajesh.kumar@tu.edu"
image: "/images/research/condensed-matter.jpg"
imageAlt: "Condensed matter physics laboratory equipment"
---
```

**Do this for all 6 research areas:**
- Update each `.md` file in `src/content/research/`
- Add `image:` and `imageAlt:` fields
- Point to corresponding image in `public/images/research/`

---

### **Step 4: Display Image on Research Detail Page**

**File:** `src/pages/research/[id].astro`

Add image display to the detail page:

```astro
---
import {getCollection, render} from 'astro:content';
import Layout from '../../layouts/Layout.astro'

export async function getStaticPaths() {
    const topics = await getCollection('research');
    return topics.map((topics) => ({
        params: {id: topics.id},
        props: {topics},
    }));
}

const {topics} = Astro.props;
const { specialization, faculty, description, contact, email, image, imageAlt } = topics.data;
const { Content } = await render(topics);
---

<Layout title={specialization} description={description}>
    <header class="detail-header">
        <h1>{specialization}</h1>
        <p>{description}</p>
    </header>

    <!-- ADD IMAGE HERE -->
    {image && (
        <div class="research-hero-image">
            <img src={image} alt={imageAlt || specialization} />
        </div>
    )}

    <section class="detail-body">
        <div class="research-details">
            <p><strong>Faculty Lead:</strong> {faculty}</p>
            <p><strong>Contact:</strong> {contact}</p>
            <p><strong>Email:</strong> <a href={`mailto:${email}`}>{email}</a></p>
        </div>

        <article class="research-content">
            <Content />
        </article>

        <a href="/research" class="back-link">← Back to Research</a>
    </section>
</Layout>

<style>
    .research-hero-image {
        margin: 2rem 0;
        border-radius: 0.5rem;
        overflow: hidden;
        background: var(--color-surface);
    }

    .research-hero-image img {
        width: 100%;
        height: auto;
        display: block;
        max-height: 400px;
        object-fit: cover;
    }
</style>
```

**What this does:**
- `{image && (...)}` — Only shows image if it exists
- `<img src={image}` — Displays the image
- `max-height: 400px` — Limits image height
- `object-fit: cover` — Fills space without distorting

---

### **Step 5: Display Featured Image on Homepage**

**File:** `src/pages/index.astro`

Update the research preview section to show images:

```astro
<section class="section research-preview">
    <div class="container">
        <h2>Research Areas</h2>
        <p class="section-subtitle">We conduct research across multiple areas of physics</p>
        <div class="card-grid">
            {researchPreview.map(item => (
                <a href={`/research/${item.id}`} class="card">
                    <!-- ADD IMAGE HERE -->
                    {item.data.image && (
                        <div class="card-image">
                            <img src={item.data.image} alt={item.data.imageAlt || item.data.specialization} />
                        </div>
                    )}
                    <h3 class="card-title">{item.data.specialization}</h3>
                    <p class="card-summary">{item.data.description}</p>
                </a>
            ))}
        </div>
        <div class="view-all">
            <a href="/research" class="view-all-link">View All Research Areas →</a>
        </div>
    </div>
</section>
```

**Add CSS styling** (in the `<style>` block):

```css
.card-image {
    width: 100%;
    height: 180px;
    background: var(--color-surface);
    border-radius: 0.375rem 0.375rem 0 0;
    overflow: hidden;
    margin: -1px -1px 1rem -1px;
}

.card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.card:hover .card-image img {
    transform: scale(1.05);
    transition: transform 0.3s ease;
}
```

**What this does:**
- Shows featured image at top of each research card
- Image is 180px tall and fills the width
- `object-fit: cover` scales image without distorting
- Hover effect: Image zooms slightly

---

### **OPTIONAL: Add Slideshow to Detail Page**

If you want a slideshow/gallery of multiple images per research area:

#### **A. Update Schema** (allow multiple images)

```typescript
const research = defineCollection({
    schema: z.object({
        specialization: z.string(),
        faculty: z.string(),
        description: z.string(),
        contact: z.string(),
        email: z.string(),
        image: z.string().optional(),           // Featured image
        images: z.array(z.string()).optional(), // ← ADD: Array of images for slideshow
    })
});
```

#### **B. Update Research Markdown**

Example with multiple images:

```markdown
---
specialization: "Condensed Matter Physics"
faculty: "Dr. Rajesh Kumar, Dr. Priya Singh"
description: "Studies physical properties of materials..."
contact: "Dr. Rajesh Kumar"
email: "rajesh.kumar@tu.edu"
image: "/images/research/condensed-matter.jpg"
images:
  - "/images/research/condensed-matter-1.jpg"
  - "/images/research/condensed-matter-2.jpg"
  - "/images/research/condensed-matter-3.jpg"
  - "/images/research/condensed-matter-lab.jpg"
---
```

#### **C. Add Slideshow to Detail Page**

```astro
---
import {getCollection, render} from 'astro:content';
import Layout from '../../layouts/Layout.astro'

export async function getStaticPaths() {
    const topics = await getCollection('research');
    return topics.map((topics) => ({
        params: {id: topics.id},
        props: {topics},
    }));
}

const {topics} = Astro.props;
const { specialization, faculty, description, contact, email, image, images } = topics.data;
const { Content } = await render(topics);

// Use images array if available, otherwise use single image
const galleryImages = images || (image ? [image] : []);
---

<Layout title={specialization} description={description}>
    <header class="detail-header">
        <h1>{specialization}</h1>
        <p>{description}</p>
    </header>

    <!-- SLIDESHOW HERE -->
    {galleryImages.length > 0 && (
        <div class="research-gallery">
            <div class="gallery-main" id="gallery">
                <img src={galleryImages[0]} alt={specialization} id="mainImage" />
                <div class="gallery-nav">
                    <button id="prevBtn" class="gallery-btn">← Prev</button>
                    <div class="gallery-counter">
                        <span id="currentSlide">1</span> / <span id="totalSlides">{galleryImages.length}</span>
                    </div>
                    <button id="nextBtn" class="gallery-btn">Next →</button>
                </div>
            </div>
            
            {galleryImages.length > 1 && (
                <div class="gallery-thumbnails">
                    {galleryImages.map((img, idx) => (
                        <img 
                            src={img} 
                            alt={`${specialization} image ${idx + 1}`}
                            class={`thumbnail ${idx === 0 ? 'active' : ''}`}
                            onclick={`showSlide(${idx})`}
                        />
                    ))}
                </div>
            )}
        </div>
    )}

    <section class="detail-body">
        <div class="research-details">
            <p><strong>Faculty Lead:</strong> {faculty}</p>
            <p><strong>Contact:</strong> {contact}</p>
            <p><strong>Email:</strong> <a href={`mailto:${email}`}>{email}</a></p>
        </div>

        <article class="research-content">
            <Content />
        </article>

        <a href="/research" class="back-link">← Back to Research</a>
    </section>
</Layout>

<style>
    .research-gallery {
        margin: 2rem 0;
        background: var(--color-surface);
        padding: 2rem;
        border-radius: 0.5rem;
    }

    .gallery-main {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .gallery-main img {
        width: 100%;
        height: 400px;
        object-fit: cover;
        border-radius: 0.375rem;
    }

    .gallery-nav {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 2rem;
    }

    .gallery-btn {
        background: var(--color-accent);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        cursor: pointer;
        font-weight: 500;
    }

    .gallery-btn:hover {
        background: #16293f;
    }

    .gallery-counter {
        font-weight: 600;
        color: var(--color-text-muted);
    }

    .gallery-thumbnails {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 0.75rem;
        margin-top: 1rem;
    }

    .thumbnail {
        width: 100%;
        height: 80px;
        object-fit: cover;
        border-radius: 0.375rem;
        border: 2px solid transparent;
        cursor: pointer;
        transition: border-color 0.2s ease;
    }

    .thumbnail:hover {
        border-color: var(--color-accent);
    }

    .thumbnail.active {
        border-color: var(--color-accent);
    }
</style>

<script>
    let currentSlide = 0;
    const slides = document.querySelectorAll('.thumbnail');
    const mainImage = document.getElementById('mainImage');
    const totalSlides = slides.length;

    function showSlide(n) {
        currentSlide = n;
        mainImage.src = slides[currentSlide].src;
        document.getElementById('currentSlide').textContent = currentSlide + 1;
        
        // Update active thumbnail
        slides.forEach(el => el.classList.remove('active'));
        slides[currentSlide].classList.add('active');
    }

    document.getElementById('nextBtn')?.addEventListener('click', () => {
        showSlide((currentSlide + 1) % totalSlides);
    });

    document.getElementById('prevBtn')?.addEventListener('click', () => {
        showSlide((currentSlide - 1 + totalSlides) % totalSlides);
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') showSlide((currentSlide + 1) % totalSlides);
        if (e.key === 'ArrowLeft') showSlide((currentSlide - 1 + totalSlides) % totalSlides);
    });
</script>
```

**Features:**
- Main image display (400px height)
- Prev/Next buttons
- Slide counter (e.g., "2 / 4")
- Thumbnail strip (clickable to jump to image)
- Keyboard navigation (arrow keys)
- Auto-active thumbnail highlighting

---

## 🖼️ Image Recommendations

### **Specifications**
- **Format:** JPG or PNG
- **Size:** 1200px wide × 600-800px tall
- **File size:** < 500KB per image
- **Naming:** Use hyphens (e.g., `condensed-matter.jpg`, not `Condensed Matter.jpg`)

### **What to Show**
- Lab equipment or facilities
- Researchers at work
- Experimental setups
- Visual representations of research
- Campus facilities

---

## ✅ Complete Checklist

- [ ] 1. Update `src/content.config.ts` — Add `image` and `imageAlt` fields
- [ ] 2. Create `public/images/research/` folder
- [ ] 3. Add images to the folder (one per research area)
- [ ] 4. Update all 6 research markdown files — Add `image:` field
- [ ] 5. Update `src/pages/research/[id].astro` — Add image display
- [ ] 6. Update `src/pages/index.astro` — Add images to research cards
- [ ] 7. Test build: `npm run build`
- [ ] 8. View in browser: Check `/research/condensed-matter` and homepage
- [ ] **Optional:** Add slideshow (steps A-C above)

---

## 🧪 Testing

```bash
# Build
npm run build

# Start dev server
npm run dev

# Test:
# 1. Visit localhost:4321 — Check homepage research cards show images
# 2. Click on a research card
# 3. Verify detail page shows featured image
# 4. If slideshow: Test prev/next buttons and keyboard arrows
```

---

## 📝 Troubleshooting

### Images not showing on homepage?
1. Check image path is correct: `/images/research/filename.jpg`
2. Image file must be in `public/images/research/`
3. Check `image:` field in markdown exactly matches filename
4. Rebuild: `npm run build`

### Images broken on detail page?
1. Same checks as above
2. Verify `imageAlt` is not required (marked `.optional()`)

### Slideshow buttons not working?
1. Check `<script>` tag is included in the `.astro` file
2. Verify element IDs match: `#nextBtn`, `#prevBtn`, `#mainImage`
3. Check browser console for JavaScript errors

### Image distorted or stretched?
- Add `object-fit: cover` to CSS
- Adjust `height` value (currently 400px for detail, 180px for cards)

---

## 🎯 Next Steps

1. **Gather images** from department or find CC0 images
2. **Save to `public/images/research/`**
3. **Update each research markdown file** with image path
4. **Run build & test**
5. **Optional: Add slideshow** if you want multiple images per area

**Result:** Every research area will have a beautiful featured image that appears on both the homepage and detail pages! 🎨

---
