import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import clsx from 'clsx';
import BenchChart from '@site/src/components/BenchChart';
import Logo from '../../static/img/helios-logo.svg';
import styles from './index.module.css';

// Static-route req/sec, current commit (fa462de) — same numbers as
// docs/benchmarks.md's Results table. Update both together; see that page's
// "Captured" line for the source run.
const ROUTING_BENCH = { Fastify: 122888, Helios: 89808, Express: 72672, NestJS: 65810 };

function Comparison() {
  return (
    <section className={clsx(styles.features, styles.comparison)}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Why HeliosJS?</h2>
          <p className={styles.sectionSubtitle}>
            The three things that actually differ from Express, Fastify, and NestJS
          </p>
        </div>

        <div className={styles.comparisonGrid}>
          <div className={styles.comparisonChart}>
            <BenchChart title="GET /users, req/sec" data={ROUTING_BENCH} />
            <p className={styles.chartCaption}>
              100 connections, median of 3×8s runs, no pipelining —{' '}
              <a href={useBaseUrl('/docs/benchmarks')}>full methodology &amp; more suites →</a>
            </p>
          </div>

          <ul className={styles.comparisonPoints}>
            <li>
              <strong>Beats Express and NestJS outright</strong> — and the reason is
              structural, not incidental: Nest's default adapter <em>is</em> Express,
              plus its own dependency-injection and module-resolution layer on top.
              Helios has no DI container to resolve — routes compile once, at
              construction time, not through an IoC graph on every request.
            </li>
            <li>
              <strong>One decorator model, four runtimes.</strong> The same{' '}
              <code>@Controller</code>/<code>@Get</code> classes run behind Node's{' '}
              <code>http</code>, AWS Lambda, Azure Functions, or gRPC — swap the
              adapter package, not the code. Express and Fastify are HTTP-only;
              NestJS needs a different mental model per platform.
            </li>
            <li>
              <strong>Where it doesn't win:</strong> Fastify's radix-tree router and
              optional schema-compiled serialization keep it ~25-30% ahead on raw
              routing throughput, and there's no DI container if that's what you're
              after. Helios pulls back ahead on Ajv-backed validation and mid/large
              JSON payloads — see the{' '}
              <a href={useBaseUrl('/docs/benchmarks-validation')}>validation</a> and{' '}
              <a href={useBaseUrl('/docs/benchmarks-serialization')}>serialization</a>{' '}
              suites.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: '🎯',
      title: 'Decorator-First',
      description:
        'Controllers, routes, guards, pipes, and validation are all declared with decorators — the request pipeline is the class definition, not a chain you assemble by hand.',
    },
    {
      icon: '🚀',
      title: 'TypeScript Native',
      description:
        'Built with TypeScript from the ground up. Full type safety, intelligent autocomplete, and excellent IDE support.',
    },
    {
      icon: '🌐',
      title: 'Multi-Transport',
      description:
        'The same controller classes serve HTTP, AWS Lambda, Azure Functions, and gRPC — pick the adapter package your deployment target needs.',
    },
    {
      icon: '🧰',
      title: 'Batteries Included',
      description:
        'Guards, pipes, DTO validation, rate limiting, CORS, and RBAC ship in core — no separate packages to assemble before you can ship a real endpoint.',
    },
  ];

  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>What's included</h2>
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
    import { Controller, Get, Post, Body } from '@heliosjs/core';
    import { Server, Helios } from '@heliosjs/http';

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

    @Server({ controllers: [ApiController] })
    class App {}

    const app = new Helios(App);
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
          <p className={styles.heroTagline}>{siteConfig.tagline}</p>
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
        <Comparison />
        <Features />
      </main>
    </Layout>
  );
}
