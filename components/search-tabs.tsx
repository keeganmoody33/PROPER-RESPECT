"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { SEARCH_QUERY_MAX } from "@/src/domain/search-listing";
import styles from "@/app/search/search.module.css";

export type SearchTab = "people" | "tools";
const TABS: readonly { value: SearchTab; label: string }[] = [{ value: "people", label: "People" }, { value: "tools", label: "Tools" }];

export function searchHref(q: string, tab: SearchTab) {
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(tab === "tools" ? { tab } : {}) }).toString();
  return params ? `/search?${params}` : "/search";
}

// Each tab is also a link that keeps the search, so the choice lives in the address and the server renders it.
export function SearchTabs({ q, tab, people, tools }: { q: string; tab: SearchTab; people: ReactNode; tools: ReactNode }) {
  const [value, setValue] = useState<SearchTab>(tab);
  return <>
    <form className={styles.form} role="search" action="/search" method="get">
      <label htmlFor="search-q">Name, handle or tool</label>
      <div className={styles.field}>
        <input id="search-q" name="q" type="search" defaultValue={q} maxLength={SEARCH_QUERY_MAX} autoComplete="off" spellCheck={false} />
        {value === "tools" && <input type="hidden" name="tab" value="tools" />}
        <button type="submit">Search</button>
      </div>
    </form>
    <Tabs className={styles.tabs} value={value} onValueChange={next => { if (next === "people" || next === "tools") setValue(next); }}>
      <TabsList className={styles.tabList} aria-label="Search for">
        {TABS.map(option => <TabsTab key={option.value} value={option.value} render={<Link href={searchHref(q, option.value)} replace scroll={false} />}>{option.label}</TabsTab>)}
      </TabsList>
      <TabsPanel className={styles.results} value="people">{people}</TabsPanel>
      <TabsPanel className={styles.results} value="tools">{tools}</TabsPanel>
    </Tabs>
  </>;
}
