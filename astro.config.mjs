import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const site = process.env.PUBLIC_SITE_URL || 'https://ispdf.org';

export default defineConfig({
  site,
  output: 'static',
  integrations: [react(), sitemap()],
});
