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
  },
});
