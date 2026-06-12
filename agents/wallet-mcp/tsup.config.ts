import { defineConfig } from 'tsup'

export default defineConfig({
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  entry: [
    'src/index.ts',
    'src/cli/sign-self-register.ts',
    'src/cli/sign-open-position.ts',
    'src/cli/sign-reduce-position.ts',
  ],
  format: ['esm'],
  minify: true,
  target: 'esnext',
  outDir: 'build',
  outExtension: ({ format }) => ({
    js: '.js',
  }),
})
