import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const courses = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/courses' }),
	schema: z.object({
		title: z.string(),
		code: z.string(),
		credits: z.number(),
		level: z.enum(['undergraduate', 'postgraduate']),
    description: z.string(),
    faculty: z.string(),
	}),
});

const admissions = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/admissions' }),
	schema: z.object({
		title: z.string(),
		program: z.enum(['integrated-bsc-msc', 'msc', 'phd']),
		tagline: z.string(),
		duration: z.string(),
		eligibility: z.array(z.string()),
		howToApply: z.array(z.string()),
		applicationDeadline: z.string(),
		contactEmail: z.email(),
		order: z.number(),
	}),
});

const newsEvents = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/news-events' }),
	schema: z.object({
		type: z.enum(['news', 'event']),
		title: z.string(),
		date: z.date(),
		summary: z.string(),
		location: z.string().optional(),
		draft: z.boolean().default(false),
	}),
});

const research = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/research'}),
    schema: z.object({
        specialization: z.string(),
        order: z.number(), // position on the Research page (1 = first)
        faculties: z.array(z.object({
            id: z.string(),
            group: z.string().optional(),
        })).default([]),
        description: z.string(),
        image: z.string().optional(), // filename in public/Research-areas/ (needs a web/ copy too)
    })
});



// People: one JSON file per section in src/content/people/ (can be generated from the Google Sheet).
// Each entry needs a unique lowercase `id`. `photo` is relative to /People-photos/

const teaching = defineCollection({
    loader: file('src/content/people/teaching.json'),
    schema: z.object({
        name: z.string(),
        designation: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        research_areas: z.array(z.string()).default([]),
        photo: z.string().optional(),
    }),
});

const nonTeaching = defineCollection({
    loader: file('src/content/people/non-teaching.json'),
    schema: z.object({
        name: z.string(),
        designation: z.string(),
        office: z.string().optional(),
        email: z.string().optional(),
        contact: z.string().optional(),
        photo: z.string().optional(),
    }),
});

const researchScholars = defineCollection({
    loader: file('src/content/people/research-scholars.json'),
    schema: z.object({
        name: z.string(),
        supervisor: z.string(),
        research_area: z.string().optional(),
        email: z.string().optional(),
        photo: z.string().optional(),
    }),
});

const researchAssistants = defineCollection({
    loader: file('src/content/people/research-assistants.json'),
    schema: z.object({
        name: z.string(),
        supervisor: z.string(),
        research_area: z.string().optional(),
        email: z.string().optional(),
        photo: z.string().optional(),
    }),
});

export const collections = {
    courses, admissions, newsEvents, research,
    teaching, nonTeaching, researchScholars, researchAssistants,
};
