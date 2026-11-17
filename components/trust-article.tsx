import Link from "next/link";
import { trustDocuments, type TrustDocument, type TrustSlug } from "@/src/server/trust-pages";
import styles from "./trust-article.module.css";

/** The About pages by the names the footer gives them, in the order the rail lists them. */
const RAIL: Readonly<Record<TrustSlug, string>> = { origins: "Origins", methodology: "How evidence works", privacy: "Privacy", terms: "Terms", contact: "Contact" };

export function TrustArticle({ document }: { document: TrustDocument }) {
  return <main className={styles.shell}>
    <nav className={styles.rail} aria-label="About Proper Respect">
      <ul>{(Object.keys(RAIL) as TrustSlug[]).map(slug => <li key={slug}><Link href={`/about/${slug}`} aria-current={trustDocuments[slug] === document ? "page" : undefined}>{RAIL[slug]}</Link></li>)}</ul>
    </nav>
    <article>
      <header>
        <p className="eyebrow">{document.eyebrow}</p>
        <h1>{document.title}</h1>
        <p className={styles.date}>Updated <time dateTime={document.updatedAt}>{document.updatedAt}</time></p>
        {document.introduction.map(paragraph => <p data-trust-copy key={paragraph}>{paragraph}</p>)}
      </header>
      {document.sections.map(section => <section key={section.heading}>
        <h2>{section.heading}</h2>
        {section.paragraphs.map(paragraph => <p data-trust-copy key={paragraph}>{paragraph}</p>)}
        {section.links && <ul>{section.links.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>}
      </section>)}
      <Link href="/">Back to Proper Respect →</Link>
    </article>
  </main>;
}
