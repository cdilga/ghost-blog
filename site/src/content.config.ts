import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    // feature image, e.g. /img/ghost/<slug>/cover.webp
    image: z.string().optional(),
    // ported from the old Ghost blog (scripts/port-live-ghost.mjs); also gets a /<slug>/ redirect
    legacy: z.boolean().default(false),
  }),
});

// standalone pages ported from Ghost (reading-list, cv, photography), each rendered by src/pages/<slug>.astro
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string().optional(),
  }),
});

export const collections = { blog, pages };
