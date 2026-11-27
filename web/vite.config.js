import { defineConfig } from 'vite';

// The summary CSVs live in ../dashboard/data, outside this folder.
export default defineConfig({
  base: './',
  server: { fs: { allow: ['..'] } },
});
