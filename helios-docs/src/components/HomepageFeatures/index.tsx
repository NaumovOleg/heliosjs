import Heading from "@theme/Heading";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Decorator-First",
    icon: "🎯",
    description: (
      <>
        Write clean, declarative code using TypeScript decorators. Controllers,
        routes, and middleware are defined with intuitive decorators.
      </>
    ),
  },
  {
    title: "TypeScript Native",
    icon: "🚀",
    description: (
      <>
        Built with TypeScript from the ground up. Full type safety, intelligent
        autocomplete, and excellent IDE support.
      </>
    ),
  },
  {
    title: "Modular Architecture",
    icon: "🔌",
    description: (
      <>
        Use only what you need. Core package provides the foundation, while
        HTTP, WebSocket, and middleware packages add functionality.
      </>
    ),
  },
  {
    title: "High Performance",
    icon: "⚡",
    description: (
      <>
        Built on Node.js core with minimal overhead. Fast routing, efficient
        middleware execution, and optimized for production workloads.
      </>
    ),
  },
  {
    title: "Extensible",
    icon: "🔧",
    description: (
      <>
        Create custom plugins, middleware, and decorators. Extend the framework
        to fit your needs.
      </>
    ),
  },
];

function Feature({ title, icon, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3" className={styles.featureTitle}>
          {title}
        </Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={clsx("row", styles.featuresRow)}>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
