import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { publicPageMetadata } from "@/src/server/public-site";
import styles from "./homepage.module.css";

const archivo = localFont({ src: "./_homepage-fonts/Archivo.ttf", variable: "--homepage-sans", display: "swap", weight: "100 900" });
const mono = localFont({ src: "./_homepage-fonts/IBMPlexMono-Bold.ttf", variable: "--homepage-mono", display: "swap", weight: "700" });

export function generateMetadata() {
  return publicPageMetadata("Your tools. Your track record.", "What you use, test, and come back to, with the history and context behind your choices.");
}

export default function HomePage() {
  return (
    <div className={`${styles.homepage} ${archivo.variable} ${mono.variable}`}>
      <a className={styles.skip} href="#homepage-content">Skip to content</a>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="Proper Respect home">
          <Image src="/brand/homepage/PR-mark-black.png" alt="" width={40} height={34} />
          <span>Proper Respect</span>
        </Link>
        <Link className={styles.navLink} href="/onboarding">Your collection</Link>
      </header>
      <main id="homepage-content" className={styles.main}>
        <section className={styles.hero} aria-labelledby="homepage-title">
          <div className={styles.intro}>
            <p className={styles.label}>What you use. What stays with you.</p>
            <h1 id="homepage-title">Your tools.<br /><span>Your track record.</span></h1>
            <p className={styles.description}>What you use, what you are testing, and the tools you come back to. Keep the history and context privately, then choose what to share.</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/onboarding">Open your collection</Link>
              <Link className={styles.secondary} href="/keegan">View Keegan’s shared collection</Link>
            </div>
            <p className={styles.privacy}>Start with a private collection. Publishing is your choice.</p>
          </div>
          <figure className={styles.figure}>
            <Image src="/brand/homepage/fists-blueprint.png" alt="Blueprint illustration of two hands meeting in a fist bump" width={2048} height={1152} sizes="(max-width: 900px) 100vw, 55vw" preload />
            <figcaption><span>The handoff</span><span>Give props. Get props.</span></figcaption>
          </figure>
        </section>
        <section className={styles.journey} aria-labelledby="journey-title">
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
        <section className={styles.close} aria-label="Start your collection">
          <p>Your tools.<br />Your point of view.</p>
          <Link className={styles.lightLink} href="/onboarding">Open your collection</Link>
        </section>
      </main>
      <footer className={styles.footer}><span>Proper Respect</span><span>Private by default. Shared by choice.</span></footer>
    </div>
  );
}
