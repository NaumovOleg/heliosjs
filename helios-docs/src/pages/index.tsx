import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import Logo from '../../static/img/helios-logo.svg';
import styles from './index.module.css';

function Features() {
  const features = [
    {
      icon: '🎯',
      title: 'Decorator-First',
      description:
        'Write clean, declarative code using TypeScript decorators. Controllers, routes, and middleware are defined with intuitive decorators.',
    },
    {
      icon: '🚀',
      title: 'TypeScript Native',
      description:
        'Built with TypeScript from the ground up. Full type safety, intelligent autocomplete, and excellent IDE support.',
    },
    {
      icon: '🔌',
      title: 'Modular Architecture',
      description:
        'Use only what you need. Core package provides the foundation, while HTTP, WebSocket, and middleware packages add functionality.',
    },
    {
      icon: '⚡',
      title: 'High Performance',
      description:
        'Built on Node.js core with minimal overhead. Fast routing, efficient middleware execution, and optimized for production workloads.',
    },
    {
      icon: '🔧',
      title: 'Extensible',
      description:
        'Create custom plugins, middleware, and decorators. Extend the framework to fit your needs.',
    },
  ];

  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Why HeliosJS?</h2>
          <p className={styles.sectionSubtitle}>
            Everything you need to build modern Node.js applications
          </p>
        </div>
        <div className={clsx('row', styles.featuresRow)}>
          {features.map((feature, idx) => (
            <div key={idx} className={clsx('col col--3', styles.featureCol)}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Code() {
  return (
    <div className={clsx(styles.heroBanner)}>
      <div className={clsx(styles.containerCode)}>
        <div className={styles.heroContent}>
          <div className={styles.codeBlock}>
            <pre>
              <code>
                {`
    import { Controller, Get, Post } from '@heliosjs/core';
    import { Helios } from '@heliosjs/http';

    @Controller('/api')
    class ApiController {
      @Get('/health')
      health() {
        return { status: 'ok' };
      }
      
      @Post('/users')
      createUser(@Body() data: UserDto) {
        return { id: 1, ...data };
      }
    }
    @Server({ controllers: [Api] })
    export class Server {}
    const app = new Helios(Server);
    app.listen(3000);
`}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// HomepageHeader Component
function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroContent}>
          <div className={styles.heroLogo}>
            <div className={styles.heroIcon}>
              <Logo />
            </div>
          </div>
          <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
          <div className={styles.buttons}>
            <a className="button button--primary button--lg" href={useBaseUrl('/docs/intro')}>
              Get Started →
            </a>
            <a
              className="button button--secondary button--lg"
              href="https://github.com/NaumovOleg/heliosjs"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

// Main Home Component
export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Decorator-based Node.js Framework`}
      description="A modern decorator-based Node.js framework for building scalable applications with TypeScript"
    >
      <HomepageHeader />
      <main>
        <Code />
        <Features />
      </main>
    </Layout>
  );
}
