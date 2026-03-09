import pluginJs from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default tseslint.defineConfig(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'bin/**',
      'build/**',
      '.config/*',
      'cdk.out/**',
      'yarn.lock',
    ],
  },

  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,js,mts,mjs}'],
    plugins: {
      prettier: prettierPlugin,
      'unused-imports': unusedImports,
      import: importPlugin,
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    rules: {
      'prettier/prettier': 'error',

      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': 'off',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Специальная группа для reflect-metadata - всегда первой
            ['^reflect-metadata$'],
            // Пакеты из node_modules
            ['^@?\\w'],
            // Алиасы
            ['^@/'],
            // Родительские импорты
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // Текущая папка
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // Стили
            ['^.+\\.s?css$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'import/no-duplicates': 'error',

      '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      'lines-between-class-members': [
        'error',
        {
          enforce: [
            { blankLine: 'always', prev: '*', next: 'method' },
            { blankLine: 'never', prev: 'field', next: 'field' },
          ],
        },
      ],

      'max-len': 'off',
      'no-duplicate-imports': 'off',
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    },
  },

  prettierConfig,
);
