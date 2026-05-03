// eslint.config.js
import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  {
    files: ['**/*.ts'],
    plugins: { prettier },
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
      'prettier/prettier': 'error',
      ...prettier.configs.recommended.rules,
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
      '.env',
      '**/*.config.js',
      '**/temp-*/**',
    ],
  }
);
