import { defineConfig, globalIgnores } from 'eslint/config';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });

export default defineConfig([
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // scripts/*.cjs are plain Node scripts where require() is idiomatic; they are not app code.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'scripts/**/*.cjs', 'tests/**/*.cjs']),
]);
