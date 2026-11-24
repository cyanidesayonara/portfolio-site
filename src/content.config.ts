import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    summary: z.string(),
    kind: z.enum(['Game', 'Desktop app', 'Hardware', 'Web app', 'Mobile app', 'Tool']),
    stack: z.array(z.string()),
    years: z.string().optional(),
    cover: z.string(),
    coverAlt: z.string(),
    // CSS object-position for cropped covers, e.g. "85% 50%".
    coverPosition: z.string().default('50% 50%'),
    // Dark covers (screenshots of dark UIs, LED panels) sit on a dark backdrop.
    coverDark: z.boolean().default(false),
    links: z.array(z.object({ label: z.string(), href: z.url() })).default([]),
    featured: z.boolean().default(false),
    order: z.number().default(100),
    color: z.enum(['saffron', 'turquoise', 'magenta', 'leaf', 'led']).default('saffron'),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    project: z.string().optional(),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, blog };
