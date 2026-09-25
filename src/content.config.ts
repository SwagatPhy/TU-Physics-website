import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
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
		level: z.enum(['undergraduate', 'postgraduate', 'doctoral']),
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
        faculties: z.array(z.object({
            name: z.string(),
            group: z.string(),
            url: z.string().optional(),
            contact: z.string().optional(),
            email: z.string().optional(),
        })),
        description: z.string(),
        image: z.string().optional(),
    })
});



// People: one collection per section; `photo` is relative to /People-photos/
const teaching = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/people/Teaching' }),
    schema: z.object({
        name: z.string(),
        designation: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        researchAreas: z.array(z.string()).default([]),
        photo: z.string().optional(),
    }),
});

const nonTeaching = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/people/Non-teaching' }),
    schema: z.object({
        name: z.string(),
        designation: z.string(),
        office: z.string().optional(),
        email: z.string().optional(),
        photo: z.string().optional(),
    }),
});

const researchScholars = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/people/Research-Scholars' }),
    schema: z.object({
        name: z.string(),
        supervisor: z.string(),
        research_area: z.string().optional(),
        email: z.string().optional(),
        photo: z.string().optional(),
    }),
});

const researchAssistants = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/people/Research-Assistants' }),
    schema: z.object({
        name: z.string(),
        supervisor: z.string(),
        researchArea: z.string().optional(),
        email: z.string().optional(),
        photo: z.string().optional(),
    }),
});

export const collections = {
    courses, admissions, newsEvents, research,
    teaching, nonTeaching, researchScholars, researchAssistants,
};
