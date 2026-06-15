import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: '@heliosjs/core/utils', replacement: resolve(root, 'src/core/src/utils/index.ts') },
      { find: '@heliosjs/core/types', replacement: resolve(root, 'src/core/src/types/index.ts') },
      { find: '@heliosjs/core', replacement: resolve(root, 'src/core/src/index.ts') },
      { find: '@heliosjs/middlewares', replacement: resolve(root, 'src/middlewares/src/index.ts') },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'src/core/src/utils/core/match.ts',
        'src/core/src/utils/shared/parsers.ts',
        'src/core/src/utils/core/controller.ts',
      ],
      thresholds: { lines: 65, functions: 75, statements: 65, branches: 65 },
    },
  },
});
