import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      '*.tsbuildinfo',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '**/*.js',
      '**/*.md',
    ],
  },

  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],

    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-console': 'warn',
    },
  },
];
