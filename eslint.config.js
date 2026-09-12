// eslint.config.js
import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  {
    files: ['**/*.ts'],
    plugins: { 'unused-imports': unusedImports },
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-extraneous-class': 'off',
      'no-console': 'warn',
      'no-unused-vars': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.config.js', '**/*.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['benchmarks/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Type-aware rules now run on __tests__ (see __tests__/tsconfig.json) so
    // no-floating-promises / consistent-type-imports / unused-* are actually
    // enforced here. The rules below stay off for tests only: loose `any` on
    // mocks/stubs and empty-body stand-ins for handlers/middleware are the
    // normal shape of test doubles, not a real type-safety gap like the
    // by-design decorator `any`s in `src/**`.
    files: ['__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
    },
  },
  {
    ignores: [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '.git',
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/coverage/',
      '.opencode',
      // Docusaurus's own generated cache/bundle (gitignored, but not
      // previously excluded here) — building the docs locally makes it
      // appear on disk and its bundled JS then gets linted as if it were
      // hand-written source, inflating the error count for everyone until
      // the next `docs:clear`.
      '**/.docusaurus/',
      '.env',
      '**/*.config.js',
      '**/temp-*/**',
      '**/vitest.config.ts',
      '**/vitest.setup.ts',
    ],
  },
]);
