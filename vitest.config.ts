import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  oxc: {
    decoratorLegacy: true,
  },
  resolve: {
    alias: [
      { find: '@heliosjs/core/utils', replacement: resolve(root, 'src/core/src/utils/index.ts') },
      { find: '@heliosjs/core/types', replacement: resolve(root, 'src/core/src/types/index.ts') },
      { find: '@heliosjs/core/constants', replacement: resolve(root, 'src/core/src/constants.ts') },
      { find: '@heliosjs/core', replacement: resolve(root, 'src/core/src/index.ts') },
      { find: '@heliosjs/middlewares', replacement: resolve(root, 'src/middlewares/src/index.ts') },
      { find: '@heliosjs/http', replacement: resolve(root, 'src/http/src/index.ts') },
      { find: '@heliosjs/grpc', replacement: resolve(root, 'src/grpc/src/index.ts') },
      { find: '@heliosjs/aws', replacement: resolve(root, 'src/aws/src/index.ts') },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.ts'],
    exclude: [
      '**/grpc/unit/server-extended.test.ts',
      '**/http/unit/factories.test.ts',
      '**/core/unit/socket/server.test.ts',
      '**/middlewares/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/core/src/**/*.ts',
        'src/http/src/**/*.ts',
        'src/aws/src/**/*.ts',
        'src/middlewares/src/**/*.ts',
        'src/grpc/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        '**/types/**',
        '**/socket/server.ts',
        '**/socket/socket.ts',
        '**/sse/server.ts',
        '**/grpc/src/server.ts',
        '**/grpc/src/client.ts',
        '**/grpc/src/module.ts',
        '**/grpc/src/utils/**',
      ],
      thresholds: { lines: 96, functions: 96, statements: 95, branches: 88 },
    },
  },
});
