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
        faculty: z.string(),
        description: z.string(),
        contact: z.string(),
        email: z.string(),

    })
});



export const collections = { courses, admissions, newsEvents, research };
