import { defineConfig } from 'astro/config';

// TODO(deploy): set `site` once a domain/hosting target is chosen (needed for
// correct sitemap/canonical URLs and social share links).
export default defineConfig({
  // site: 'https://physics.tezu.ac.in',
  outDir: './dist',
  srcDir: './src',
  publicDir: './public',
});
