import type { Metadata } from "next";
import Link from "next/link";
import { SearchTabs, type SearchTab } from "@/components/search-tabs";
import { searchPeople, searchQueryProblem, searchTools } from "@/src/data/search";
import { publicPathMetadata } from "@/src/server/public-site";
import { moreResultsText, searchPageDescription, searchPageTitle, toolCountsText } from "@/src/server/search-copy";
import styles from "./search.module.css";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type SearchPageProps = { searchParams: SearchParams };

async function readParams(searchParams: SearchParams): Promise<{ q: string; tab: SearchTab }> {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  return { q: one(params.q).trim(), tab: one(params.tab) === "tools" ? "tools" : "people" };
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await readParams(searchParams);
  const metadata = publicPathMetadata(searchPageTitle, searchPageDescription, "/search");
  // A results page for one search is not a page of its own for search engines.
  return q ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

function PeopleResults({ q, people, more }: { q: string } & Awaited<ReturnType<typeof searchPeople>>) {
  return <>
    <h2>{q ? `People matching “${q}”` : "People with a listed page, A to Z"}</h2>
    {people.length === 0
      ? <p className={styles.note}>{q ? "No listed page matches that. Try part of a name or a handle." : "No pages are listed yet."}</p>
      : <ul className={styles.list}>{people.map(person => <li key={person.handle}>
        <Link href={`/${person.handle}`}><span className={styles.name}>{person.displayName}</span><span className={styles.meta}>@{person.handle}</span></Link>
      </li>)}</ul>}
    {more && <p className={styles.note}>{moreResultsText("people", Boolean(q))}</p>}
  </>;
}

function ToolResults({ q, tools, more }: { q: string } & Awaited<ReturnType<typeof searchTools>>) {
  return <>
    <h2>{q ? `Tools matching “${q}”` : "Tools on listed pages"}</h2>
    {!q && tools.length > 0 && <p className={styles.note}>Shown by how many people list each one.</p>}
    {tools.length === 0
      ? <p className={styles.note}>{q ? "No listed page has a tool by that name yet." : "No pages are listed yet."}</p>
      : <ul className={styles.list}>{tools.map(tool => <li key={tool.slug}>
        <Link href={`/tools/${tool.slug}`}><span className={styles.name}>{tool.name}</span><span className={styles.meta}>{toolCountsText(tool)}</span></Link>
      </li>)}</ul>}
    {more && <p className={styles.note}>{moreResultsText("tools", Boolean(q))}</p>}
  </>;
}

function TooLong({ problem }: { problem: string }) {
  return <><h2>That search is too long</h2><p className={styles.problem} role="alert">{problem}</p></>;
}

async function panels(q: string) {
  const problem = searchQueryProblem(q);
  if (problem) return { people: <TooLong problem={problem} />, tools: <TooLong problem={problem} /> };
  // Both lists are bounded, so both tabs are ready the moment either is chosen.
  const [people, tools] = await Promise.all([searchPeople(q), searchTools(q)]);
  return { people: <PeopleResults q={q} {...people} />, tools: <ToolResults q={q} {...tools} /> };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, tab } = await readParams(searchParams);
  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Search</p>
      <h1 className={styles.title}>{searchPageTitle}</h1>
      <p className={styles.lede}>Find a person by name or handle, or a tool and everyone who uses it now or used it before. Only pages their owners list show here.</p>
      <SearchTabs key={`${tab}:${q}`} q={q} tab={tab} {...await panels(q)} />
    </main>
  );
}
