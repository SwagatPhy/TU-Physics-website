import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import YAML from 'yaml';
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
		program: z.enum(['integrated-bsc-msc', 'integrated-bsc-bed', 'msc', 'phd']),
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



// People: all four sections live in ONE file, src/content/people.yaml (test version).
// `photo` is relative to /People-photos/
const peopleList = (section: string) =>
    file('src/content/people.yaml', { parser: (text) => YAML.parse(text)[section] });

const teaching = defineCollection({
    loader: peopleList('teaching'),
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
    loader: peopleList('nonTeaching'),
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
    loader: peopleList('researchScholars'),
    schema: z.object({
        name: z.string(),
        supervisor: z.string(),
        research_area: z.string().optional(),
        email: z.string().optional(),
        photo: z.string().optional(),
    }),
});

const researchAssistants = defineCollection({
    loader: peopleList('researchAssistants'),
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
