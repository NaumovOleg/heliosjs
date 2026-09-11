import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const description =
  'HeliosJS — decorator-based Node.js framework documentation: guides, API reference and examples for building structured server applications.';

const config: Config = {
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  title: 'HeliosJS Documentation',
  tagline: 'Decorator-based Node.js framework',
  url: 'https://NaumovOleg.github.io',
  baseUrl: '/heliosjs/',
  organizationName: 'NaumovOleg',
  projectName: 'heliosjs',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/NaumovOleg/heliosjs/edit/master/helios-docs/',
        },
        blog: false,

        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  themeConfig: {
    metadata: [
      {
        name: 'google-site-verification',
        content: 'hEtFOs8PwKPXzC3aQuHkawuox0SGhmo31y50eYKXChg',
      },
      { name: 'description', content: description },
      {
        name: 'keywords',
        content: 'helios, heliosjs, node.js, framework, decorators, typescript, api, docs',
      },
      { property: 'og:title', content: 'HeliosJS Documentation' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://NaumovOleg.github.io/heliosjs' },
      { property: 'og:description', content: description },
      { property: 'og:site_name', content: 'HeliosJS' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: 'HeliosJS Documentation' },
      { name: 'twitter:description', content: description },
    ],
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'HELIOS',
      logo: {
        alt: 'HELIOS Logo',
        src: 'img/helios-logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Tutorial',
        },
        {
          href: 'https://github.com/NaumovOleg/heliosjs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/docs/intro' },
            { label: 'Request Lifecycle', to: '/docs/core-module/request-lifecycle' },
            { label: 'HTTP Server', to: '/docs/http-module/server' },
            { label: 'AWS Lambda', to: '/docs/aws/lambda-integration' },
            { label: 'gRPC', to: '/docs/grpc/module' },
          ],
        },
        {
          title: 'Packages',
          items: [
            { label: '@heliosjs/core', href: 'https://www.npmjs.com/package/@heliosjs/core' },
            { label: '@heliosjs/http', href: 'https://www.npmjs.com/package/@heliosjs/http' },
            { label: '@heliosjs/aws', href: 'https://www.npmjs.com/package/@heliosjs/aws' },
            {
              label: '@heliosjs/middlewares',
              href: 'https://www.npmjs.com/package/@heliosjs/middlewares',
            },
            { label: '@heliosjs/grpc', href: 'https://www.npmjs.com/package/@heliosjs/grpc' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'GitHub', href: 'https://github.com/NaumovOleg/heliosjs' },
            { label: 'Issues', href: 'https://github.com/NaumovOleg/heliosjs/issues' },
            {
              label: 'Benchmarks',
              to: '/docs/benchmarks',
            },
            { label: 'License (MIT)', href: 'https://github.com/NaumovOleg/heliosjs/blob/master/LICENSE' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} HeliosJS. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
