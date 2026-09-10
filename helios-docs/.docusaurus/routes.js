import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/heliosjs/__docusaurus/debug',
    component: ComponentCreator('/heliosjs/__docusaurus/debug', '584'),
    exact: true
  },
  {
    path: '/heliosjs/__docusaurus/debug/config',
    component: ComponentCreator('/heliosjs/__docusaurus/debug/config', '502'),
    exact: true
  },
  {
    path: '/heliosjs/__docusaurus/debug/content',
    component: ComponentCreator('/heliosjs/__docusaurus/debug/content', 'e08'),
    exact: true
  },
  {
    path: '/heliosjs/__docusaurus/debug/globalData',
    component: ComponentCreator('/heliosjs/__docusaurus/debug/globalData', '0ba'),
    exact: true
  },
  {
    path: '/heliosjs/__docusaurus/debug/metadata',
    component: ComponentCreator('/heliosjs/__docusaurus/debug/metadata', '4be'),
    exact: true
  },
  {
    path: '/heliosjs/__docusaurus/debug/registry',
    component: ComponentCreator('/heliosjs/__docusaurus/debug/registry', '9c0'),
    exact: true
  },
  {
    path: '/heliosjs/__docusaurus/debug/routes',
    component: ComponentCreator('/heliosjs/__docusaurus/debug/routes', '9ad'),
    exact: true
  },
  {
    path: '/heliosjs/blog',
    component: ComponentCreator('/heliosjs/blog', '840'),
    exact: true
  },
  {
    path: '/heliosjs/docs',
    component: ComponentCreator('/heliosjs/docs', '674'),
    routes: [
      {
        path: '/heliosjs/docs',
        component: ComponentCreator('/heliosjs/docs', '775'),
        routes: [
          {
            path: '/heliosjs/docs',
            component: ComponentCreator('/heliosjs/docs', '110'),
            routes: [
              {
                path: '/heliosjs/docs/aws/lambda-integration',
                component: ComponentCreator('/heliosjs/docs/aws/lambda-integration', 'e31'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/aws/plugins',
                component: ComponentCreator('/heliosjs/docs/aws/plugins', '33f'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/core-module/controllers',
                component: ComponentCreator('/heliosjs/docs/core-module/controllers', '478'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/core-module/error',
                component: ComponentCreator('/heliosjs/docs/core-module/error', '873'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/core-module/installation',
                component: ComponentCreator('/heliosjs/docs/core-module/installation', '48f'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/core-module/parameter-decorators',
                component: ComponentCreator('/heliosjs/docs/core-module/parameter-decorators', '01d'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/core-module/rate-limiting',
                component: ComponentCreator('/heliosjs/docs/core-module/rate-limiting', '275'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/core-module/validation',
                component: ComponentCreator('/heliosjs/docs/core-module/validation', '158'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/grpc/api',
                component: ComponentCreator('/heliosjs/docs/grpc/api', '259'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/grpc/examples',
                component: ComponentCreator('/heliosjs/docs/grpc/examples', '262'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/grpc/module',
                component: ComponentCreator('/heliosjs/docs/grpc/module', '23c'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/grpc/usage',
                component: ComponentCreator('/heliosjs/docs/grpc/usage', '701'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/http-module/graph-ql',
                component: ComponentCreator('/heliosjs/docs/http-module/graph-ql', '4c5'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/http-module/plugins',
                component: ComponentCreator('/heliosjs/docs/http-module/plugins', '1f3'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/http-module/server',
                component: ComponentCreator('/heliosjs/docs/http-module/server', 'b40'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/http-module/server-sent-events',
                component: ComponentCreator('/heliosjs/docs/http-module/server-sent-events', '244'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/http-module/websockets',
                component: ComponentCreator('/heliosjs/docs/http-module/websockets', '2de'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/intro',
                component: ComponentCreator('/heliosjs/docs/intro', 'e9a'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/basics',
                component: ComponentCreator('/heliosjs/docs/middlewares/basics', '362'),
                exact: true
              },
              {
                path: '/heliosjs/docs/middlewares/catch',
                component: ComponentCreator('/heliosjs/docs/middlewares/catch', 'f39'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/cors',
                component: ComponentCreator('/heliosjs/docs/middlewares/cors', '1fd'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/fingerprint',
                component: ComponentCreator('/heliosjs/docs/middlewares/fingerprint', '5bd'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/guard',
                component: ComponentCreator('/heliosjs/docs/middlewares/guard', '765'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/intercept',
                component: ComponentCreator('/heliosjs/docs/middlewares/intercept', '3e6'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/pipe',
                component: ComponentCreator('/heliosjs/docs/middlewares/pipe', '441'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/roles',
                component: ComponentCreator('/heliosjs/docs/middlewares/roles', 'bf5'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/sanitize',
                component: ComponentCreator('/heliosjs/docs/middlewares/sanitize', '785'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/heliosjs/docs/middlewares/use',
                component: ComponentCreator('/heliosjs/docs/middlewares/use', '594'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/heliosjs/',
    component: ComponentCreator('/heliosjs/', '0b1'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
