#!/usr/bin/env node
/**
 * Deletes Astro's cached content before every build ("prebuild" in package.json).
 *
 * Why: when a content folder becomes completely empty — e.g. office staff
 * delete the last notice in the CMS — Astro's loader finds no files and keeps
 * the old cached entries, so the deleted notice would stay on the site.
 * Removing the cache makes every build read src/content/ fresh. The site is
 * small, so this costs well under a second.
 */
import { rmSync } from 'node:fs';

for (const cacheFile of ['node_modules/.astro/data-store.json', '.astro/data-store.json']) {
	rmSync(cacheFile, { force: true });
}
