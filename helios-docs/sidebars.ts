import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Basics',
      items: [
        'core-module/installation',
        'core-module/request-lifecycle',
        'core-module/controllers',
        'core-module/error',
        'core-module/validation',
        'core-module/parameter-decorators',
        'core-module/rate-limiting',
        'core-module/logging',
      ],
    },
    {
      type: 'category',
      label: 'Middlewares',
      items: [
        'middlewares/use',
        'middlewares/catch',
        'middlewares/intercept',
        'middlewares/pipe',
        'middlewares/sanitize',
        'middlewares/cors',
        'middlewares/guard',
        'middlewares/roles',
        'middlewares/fingerprint',
        'middlewares/status',
      ],
    },
    {
      type: 'category',
      label: 'Http',
      items: [
        'http-module/server',
        'http-module/websockets',
        'http-module/server-sent-events',
        'http-module/graph-ql',
        'http-module/plugins',
      ],
    },
    {
      type: 'category',
      label: 'AWS',
      items: ['aws/lambda-integration', 'aws/plugins'],
    },
    {
      type: 'category',
      label: 'GRPC',
      items: ['grpc/module', 'grpc/usage', 'grpc/api', 'grpc/examples'],
    },
    {
      type: 'category',
      label: 'Benchmarks',
      items: [
        'benchmarks',
        'benchmarks-middleware',
        'benchmarks-validation',
        'benchmarks-serialization',
      ],
    },
  ],
};

export default sidebars;
