import Image from "next/image";
import Link from "next/link";
import { ProductExample } from "@/components/product-example";
import { publicPageMetadata } from "@/src/server/public-site";
import { PublicSiteGuideWebMcp } from "@/components/public-site-guide-webmcp";
import { homepageExamples } from "@/src/data/homepage-examples";
import { homepageSteps, productIdentity, publicSiteGuide, siteDescription, siteLine } from "@/src/server/agent-discovery";
import { originsPullQuote } from "@/src/server/trust-pages";
import styles from "./homepage.module.css";

export function generateMetadata() {
  const metadata = publicPageMetadata(`Proper Respect: ${siteLine}`, siteDescription);
  return { ...metadata, alternates: { ...metadata.alternates, types: { "text/markdown": "/index.md" } } };
}

export default function HomePage() {
  return (
    <div className={styles.homepage}>
      <PublicSiteGuideWebMcp guide={publicSiteGuide()} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productIdentity()).replace(/</g, "\\u003c") }} />
      <main id="homepage-content" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="homepage-title">
          <h1 id="homepage-title" className={styles.title}>{siteLine}</h1>
          {/* Right after the heading, so a phone shows a card in its first screen; a wide screen sets the actions beside it. */}
          <div className={styles.example} id="example"><ProductExample examples={homepageExamples()} /></div>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/app/collection">Start your collection</Link>
            <Link className={styles.secondary} href="/lecturesfrom">View Keegan’s shared collection</Link>
          </div>
        </section>
        <section id="how-it-works" className={styles.journey} aria-labelledby="journey-title">
          <h2 id="journey-title" className={styles.statement}>A résumé says where you worked.<br />This shows what you run.</h2>
          <ol className={styles.steps}>
            {homepageSteps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.body}</p></li>)}
          </ol>
        </section>
        <section className={styles.respect} aria-labelledby="respect-title">
          <div className={styles.respectInner}>
            <div className={styles.respectCopy}>
              <h2 id="respect-title" className={styles.statement}>Give props.<br />Get props.</h2>
              <figure className={styles.quote}>
                <blockquote>{originsPullQuote.text}</blockquote>
                <figcaption>{originsPullQuote.source}</figcaption>
              </figure>
              <p>Proper Respect takes its name from giving someone their props. Here the props are for what you run and how long you have run it, on a record your peers can read.</p>
              <Link className={styles.onDark} href="/about/origins">Read where the name comes from</Link>
            </div>
            <Image className={styles.bump} src="/brand/homepage/bump-art.png" alt="Two fists meeting at a bright red diamond" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 45vw" />
          </div>
        </section>
        <section className={styles.close} aria-labelledby="start-title">
          <h2 id="start-title" className={styles.statement}>Make it yours.</h2>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/app/collection">Start your collection</Link>
            <Link className={styles.secondary} href="/lecturesfrom">See the shared collection</Link>
          </div>
          <p className={styles.privacy}>Private by default. Shared by choice.</p>
          <p className={styles.privacy}>Created by lecturesfrom, a business in the United States. <Link href="/about/contact">Contact: 33@lecturesfrom.com</Link>.</p>
        </section>
      </main>
    </div>
  );
}
