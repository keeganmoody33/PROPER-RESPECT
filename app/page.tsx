import Image from "next/image";
import Link from "next/link";
import { ProductExample } from "@/components/product-example";
import { publicPageMetadata } from "@/src/server/public-site";
import { PublicSiteGuideWebMcp } from "@/components/public-site-guide-webmcp";
import { homepageExamples } from "@/src/data/homepage-examples";
import { homepageBrowse, homepageSteps, productIdentity, publicSiteGuide, siteDescription, siteLine } from "@/src/server/agent-discovery";
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
          {/* Right after the heading, then the examples, so a phone shows the way to start and a card in its first screen; a wide screen
              sets the line and the art beside the card, with the actions under them. */}
          <div className={`${styles.actions} ${styles.heroActions}`}>
            <Link className={styles.primary} href="/app/collection">Start your collection</Link>
            <Link className={styles.secondary} href="/lecturesfrom">See Keegan’s tooling page</Link>
          </div>
          <div className={styles.example} id="example"><ProductExample examples={homepageExamples()} /></div>
          <div className={styles.side}>
            <p className={styles.lede}>{siteDescription}</p>
            <Image className={styles.bump} src="/brand/homepage/bump-art.png" alt="Two fists meeting at a bright red diamond" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 45vw" priority />
          </div>
        </section>
        <section id="how-it-works" className={styles.journey} aria-labelledby="journey-title">
          <h2 id="journey-title" className={styles.statement}>A résumé says where you worked.<br />This shows what you run.</h2>
          <ol className={styles.steps}>
            {homepageSteps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.body}</p></li>)}
          </ol>
        </section>
        <section className={styles.browse} aria-labelledby="browse-title">
          <h2 id="browse-title" className={styles.statement}>{homepageBrowse.title}</h2>
          <div className={styles.browseCopy}>
            <p>{homepageBrowse.body}</p>
            <Link className={styles.primary} href="/search">{homepageBrowse.action}</Link>
          </div>
        </section>
        <section className={styles.respect} aria-labelledby="respect-title">
          <div className={styles.respectInner}>
            <h2 id="respect-title" className={styles.statement}>Give props.<br />Get props.</h2>
            <div className={styles.respectCopy}>
              <p>Respect is what your usage earns: what you run and how long you have run it, on a page your peers can read. Props are the credit you give whoever put you on a tool, and the credit you get when you put someone on one.</p>
              <Link className={styles.onDark} href="/about/origins">Where the name comes from</Link>
            </div>
          </div>
        </section>
        <section className={styles.close} aria-labelledby="start-title">
          <h2 id="start-title" className={styles.statement}>Make it yours.</h2>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/app/collection">Start your collection</Link>
            <Link className={styles.secondary} href="/lecturesfrom">See Keegan’s tooling page</Link>
          </div>
          <p className={styles.privacy}>Private by default. Shared by choice.</p>
          <p className={styles.privacy}>Created by lecturesfrom, a business in the United States. <Link href="/about/contact">Contact: 33@lecturesfrom.com</Link>.</p>
        </section>
      </main>
    </div>
  );
}
