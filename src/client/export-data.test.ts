import { describe, expect, it, vi } from "vitest";
import { buildExport, collectPages, exportFilename } from "./export-data";

describe("collectPages (R15)", () => {
  it("follows the cursor until the last page", async () => {
    const pages = [
      { page: [1, 2], isDone: false, continueCursor: "c1" },
      { page: [3, 4], isDone: false, continueCursor: "c2" },
      { page: [5], isDone: true, continueCursor: "c3" },
    ];
    const fetchPage = vi.fn(async (cursor: string | null) => pages[cursor === null ? 0 : cursor === "c1" ? 1 : 2]);
    expect(await collectPages(fetchPage)).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([null, "c1", "c2"]);
  });

  it("stops rather than loop forever if the cursor never advances", async () => {
    const fetchPage = vi.fn(async () => ({ page: [1], isDone: false, continueCursor: "same" }));
    await expect(collectPages(fetchPage)).rejects.toThrow("The export did not finish");
  });

  it("stops if a cursor comes back around", async () => {
    const cursors = ["a", "b", "a"];
    const fetchPage = vi.fn(async (cursor: string | null) => ({ page: [cursor], isDone: false, continueCursor: cursors[cursor === null ? 0 : cursor === "a" ? 1 : 2] }));
    await expect(collectPages(fetchPage)).rejects.toThrow("The export did not finish");
  });

  it("has no page limit for a large account", async () => {
    const pages = 1500;
    const fetchPage = vi.fn(async (cursor: string | null) => {
      const index = cursor === null ? 0 : Number(cursor);
      return { page: [index], isDone: index + 1 === pages, continueCursor: String(index + 1) };
    });
    expect(await collectPages(fetchPage)).toHaveLength(pages);
  });
});

describe("buildExport (R15)", () => {
  it("labels the export and keeps each section", () => {
    const exported = buildExport({ profile: { handle: "owner" }, relationships: [{ id: "p1" }], evidence: [], exportedAt: "2026-09-28T12:00:00.000Z" });
    expect(exported).toMatchObject({
      format: "proper-respect-export", version: 1, exportedAt: "2026-09-28T12:00:00.000Z",
      profile: { handle: "owner" }, relationships: [{ id: "p1" }], evidence: [],
    });
    expect(exported.excluded).toEqual(expect.arrayContaining([
      expect.stringMatching(/original/i),
      expect.stringMatching(/content hashes and deduplication keys/i),
      // Records the export doesn't carry yet are named, so the file doesn't read as complete.
      expect.stringMatching(/connected accounts.*daily refresh.*earlier handles/i),
    ]));
  });

  it("names the file after the handle and date", () => {
    expect(exportFilename("owner", "2026-09-28T12:00:00.000Z")).toBe("proper-respect-owner-2026-09-28.json");
  });
});
