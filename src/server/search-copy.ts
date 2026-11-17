import type { SearchTool } from "@/src/data/search";

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
