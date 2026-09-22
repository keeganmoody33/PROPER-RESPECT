import Link from "next/link";
import type { TrustDocument } from "@/src/server/trust-pages";
import styles from "./trust-article.module.css";

export function TrustArticle({ document }: { document: TrustDocument }) {
  return <main className={styles.shell}>
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
