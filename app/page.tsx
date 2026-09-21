import Image from "next/image";
import Link from "next/link";
import { ProductExample } from "@/components/product-example";
import { publicPageMetadata } from "@/src/server/public-site";
import styles from "./homepage.module.css";

export function generateMetadata() {
  return publicPageMetadata("Your tools. Your track record.", "What you use, test, and come back to, with the history and context behind your choices.");
}

export default function HomePage() {
  return (
    <div className={styles.homepage}>
      <main id="homepage-content" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="homepage-title">
          <div className={styles.intro}>
            <p className={styles.label}>A personal record of the tools you use.</p>
            <h1 id="homepage-title">Your tools.<br /><span>Your track record.</span></h1>
            <p className={styles.description}>Build a collection of the tools you use. Add your experience and usage evidence where available, then choose which cards to share on your profile.</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/collection">Start your collection</Link>
              <Link className={styles.secondary} href="/keegan">View Keegan’s shared collection</Link>
            </div>
            <p className={styles.privacy}>Start with a private collection. Publishing is your choice.</p>
          </div>
          <div className={styles.example} id="example"><ProductExample /></div>
        </section>
        <section id="how-it-works" className={styles.journey} aria-labelledby="journey-title">
          <div className={styles.sectionHeading}>
            <h2 id="journey-title">A collection that<br />tells your story.</h2>
            <p>From a tool you are trying to one you keep coming back to.</p>
          </div>
          <ol className={styles.steps}>
            <li><span className={styles.stepNumber} aria-hidden="true">01 / Collect</span><h3>Start with one tool.</h3><p>Sign in, add a product manually or connect a supported source. Keep what you find in your private collection.</p></li>
            <li><span className={styles.stepNumber} aria-hidden="true">02 / Make it yours</span><h3>Keep the context.</h3><p>Record what you use, what you are testing, and what you have moved on from. Add your own notes and choose your go-to tools.</p></li>
            <li><span className={styles.stepNumber} aria-hidden="true">03 / Share deliberately</span><h3>Preview every choice.</h3><p>Select the saved cards and details you want to share. Review the exact preview before you approve publication.</p></li>
          </ol>
        </section>
        <section className={styles.respect} aria-labelledby="respect-title">
          <div className={styles.respectInner}>
            <figure className={styles.bump}>
              <Image src="/brand/homepage/bump-art.png" alt="Two fists meeting at a bright red diamond" width={1536} height={1024} sizes="(max-width: 900px) 100vw, 45vw" />
              <figcaption>Fig. 02 / Credit changes hands</figcaption>
            </figure>
            <div className={styles.respectCopy}>
              <p className={styles.label}>Respect / Goes both ways</p>
              <h2 id="respect-title">Give props.<br /><span>Get props.</span></h2>
              <p>Record why you use a tool and what changed when you tried it. Add notes or supporting evidence. Choose which saved cards and details appear on your public page.</p>
              <p className={styles.kicker}>Your tools. Your point of view.</p>
            </div>
          </div>
        </section>
        <section className={styles.close} aria-labelledby="start-title">
          <h2 id="start-title">Make it<br /><span>your collection.</span></h2>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/collection">Start your collection</Link>
            <Link className={styles.secondary} href="/keegan">See the shared collection →</Link>
            <p className={styles.privacy}>Private by default. Shared by choice.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
