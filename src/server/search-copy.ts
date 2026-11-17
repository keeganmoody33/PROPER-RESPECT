import type { SearchTool } from "@/src/data/search";
import { SEARCH_RESULTS_MAX } from "@/src/domain/search-listing";

// How many people list a tool, now and before. A count per tool; nothing here scores a person.
export function usesNowText(count: number) {
  return count === 1 ? "1 person uses it now" : `${count} people use it now`;
}

export function usedBeforeText(count: number) {
  return count === 1 ? "1 person used it before" : `${count} people used it before`;
}

export function toolCountsText(tool: Pick<SearchTool, "peopleNow" | "peopleBefore">) {
  return [tool.peopleNow > 0 && usesNowText(tool.peopleNow), tool.peopleBefore > 0 && usedBeforeText(tool.peopleBefore)]
    .filter(Boolean).join(" · ");
}

export const searchPageTitle = "Search people and tools";
export const searchPageDescription = "Find a tooling page by name or handle, or find a tool and the people who use it now or used it before.";

/**
 * The note under a list that was cut off. A search takes its matches by closeness and shows them A to Z, so it says
 * "closest", never "first"; a browse with no search is in its stated order, so "first" is true there.
 */
export function moreResultsText(list: "people" | "tools", searched: boolean) {
  if (searched) return `Showing the ${SEARCH_RESULTS_MAX} closest matches, A to Z. Add more of the name to narrow it.`;
  return `Showing the first ${SEARCH_RESULTS_MAX}. ${list === "people" ? "Search to find someone else." : "Search to find another tool."}`;
}
