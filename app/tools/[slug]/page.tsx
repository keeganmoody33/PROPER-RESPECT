import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getToolPage, type ToolGroup, type ToolPageData } from "@/src/data/search";
import { SHOW_PAST_USERS, TOOL_CURSOR_MAX } from "@/src/domain/search-listing";
import { publicPathMetadata } from "@/src/server/public-site";
import { toolCountsText, usedBeforeText, usesNowText } from "@/src/server/search-copy";
import styles from "../../search/search.module.css";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type Cursors = { nowAfter?: string; beforeAfter?: string };

async function readCursors(searchParams: ToolPageProps["searchParams"]): Promise<Cursors> {
  const params = await searchParams;
  // A mark that is too long to be one of ours is ignored, and the group starts from A.
  const cursor = (value: string | string[] | undefined) => {
    const one = Array.isArray(value) ? value[0] : value;
    return one && one.length <= TOOL_CURSOR_MAX ? one : undefined;
  };
  return { nowAfter: cursor(params.now), beforeAfter: cursor(params.before) };
}

const toolTitle = (tool: Pick<ToolPageData, "name">) => `${tool.name}: who uses it`;

export async function generateMetadata({ params, searchParams }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolPage(slug);
  if (!tool) return { title: "Page not found", robots: { index: false, follow: false } };
  const metadata = publicPathMetadata(toolTitle(tool), `${toolCountsText(tool)}, on pages listed in search. Each links to their tooling page.`, `/tools/${tool.slug}`);
  const { nowAfter, beforeAfter } = await readCursors(searchParams);
  // Later pages of the same list point search engines back to the first.
  return nowAfter || beforeAfter ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

function moreHref(slug: string, cursors: Cursors) {
  const params = new URLSearchParams({ ...(cursors.nowAfter ? { now: cursors.nowAfter } : {}), ...(cursors.beforeAfter ? { before: cursors.beforeAfter } : {}) });
  return `/tools/${slug}?${params.toString()}`;
}

function People({ id, title, count, note, empty, group, more }: {
  id: string; title: string; count: string; note?: string; empty: string; group: ToolGroup; more?: { href: string; label: string };
}) {
  return <section className={styles.group} aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    <p className={styles.note}><span className={styles.count}>{count}</span>{note ? `. ${note}` : ""}</p>
    {group.people.length === 0
      ? <p className={styles.note}>{empty}</p>
      : <ul className={styles.list}>{group.people.map(person => <li key={person.handle}>
        <Link href={`/${person.handle}`}><span className={styles.name}>{person.displayName}</span><span className={styles.meta}>@{person.handle} · {person.levelLabel}</span></Link>
      </li>)}</ul>}
    {more && <Link className={styles.more} href={more.href}>{more.label}</Link>}
  </section>;
}

export default async function ToolPage({ params, searchParams }: ToolPageProps) {
  const { slug } = await params;
  const cursors = await readCursors(searchParams);
  const tool = await getToolPage(slug, cursors);
  if (!tool) notFound();
  return (
    <main className={styles.page}>
      <p className={styles.kicker}><Link href="/search?tab=tools">Tools</Link> / {tool.name}</p>
      <h1 className={styles.title}>{tool.name}</h1>
      <p className={styles.lede}>Who has {tool.name} on their tooling page, now and before. Each name opens that person’s page. Names run A to Z.</p>
      <div className={styles.groups}>
        <People id="uses-now" title="Uses it now" count={usesNowText(tool.peopleNow)} empty={`Nobody on a listed page uses ${tool.name} right now.`}
          group={tool.now} more={tool.now.nextAfter ? { href: moreHref(tool.slug, { ...cursors, nowAfter: tool.now.nextAfter }), label: "More people who use it now" } : undefined} />
        {SHOW_PAST_USERS && <People id="used-before" title="Used before" count={usedBeforeText(tool.peopleBefore)} note="Past tools count: these people stopped, paused or tried it"
          empty={`Nobody on a listed page has used ${tool.name} before.`}
          group={tool.before} more={tool.before.nextAfter ? { href: moreHref(tool.slug, { ...cursors, beforeAfter: tool.before.nextAfter }), label: "More people who used it before" } : undefined} />}
      </div>
    </main>
  );
}
