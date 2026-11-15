import { getFunctionName } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";

const { fetchQuery } = vi.hoisted(() => ({ fetchQuery: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery }));
vi.mock("@/src/env", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" }) }));
import { getPublicProfile, PublicProfilePayloadError } from "./get-public-profile";
import { USE_OTHER_MAX } from "@/src/domain/product-uses";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function stringLeaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringLeaves);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringLeaves);
  return [];
}

test.each(["0", "1"])("an invalid handle is absent, not an error, and never reaches the backend (E2E reference %s)", async (mode) => {
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", mode);

  await expect(getPublicProfile("Not A Handle!")).resolves.toBeNull();
  expect(fetchQuery).not.toHaveBeenCalled();
});

test("an unpublished profile is absent", async () => {
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "0");
  fetchQuery.mockResolvedValueOnce(null);

  await expect(getPublicProfile("owner")).resolves.toBeNull();
  expect(fetchQuery).toHaveBeenCalledOnce();
});

test("a malformed backend payload is a named error that repeats none of the payload", async () => {
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "0");
  const payload = {
    handle: "payload-handle-7f3a", displayName: "Payload display name 7f3a", bio: "Payload bio 7f3a",
    cards: [{
      product: { name: "Payload product 7f3a", slug: "Payload Slug 7f3a", domain: "payload-7f3a.example", description: "Payload description 7f3a" },
      status: "PAYLOAD_STATUS_7F3A", headline: "Payload headline 7f3a", note: "Payload note 7f3a",
    }],
  };
  fetchQuery.mockResolvedValueOnce(payload);

  const error = await getPublicProfile("owner").then(() => undefined, (reason: unknown) => reason);
  expect(error).toBeInstanceOf(PublicProfilePayloadError);
  // Every own field (message, name, cause, ...) except the stack, whose file
  // paths vary by checkout; the stack only repeats the message.
  const exposed = JSON.stringify(error, Object.getOwnPropertyNames(error).filter(key => key !== "stack"));
  expect(exposed).toContain("The published profile could not be read.");
  for (const text of [...stringLeaves(payload), "7f3a", "7F3A"]) expect(exposed).not.toContain(text);
});

test("a transport failure is thrown as itself, not reported as absence or a bad payload", async () => {
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "0");
  const failure = new Error("Convex transport failed");
  fetchQuery.mockRejectedValueOnce(failure);

  await expect(getPublicProfile("owner")).rejects.toBe(failure);
});

test("the current web reader requests v2 and renders the approved no-website product without a fabricated link", async () => {
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "0");
  const profile = {
    handle: "owner", displayName: "Owner", bio: "",
    cards: [{
      product: { name: "Owner's tool", slug: "owner-tool", domain: "", description: "" },
      status: "TESTING", headline: "A tool I am testing", note: "Owner description",
    }],
  };
  fetchQuery.mockResolvedValueOnce(profile);

  expect(await getPublicProfile("owner")).toEqual(profile);
  expect(getFunctionName(fetchQuery.mock.calls[0][0])).toBe("publicProfiles:getByHandleV2");
  expect(fetchQuery.mock.calls[0].slice(1)).toEqual([{ handle: "owner" }, { url: "https://test.convex.cloud" }]);
});

test("a stored card whose uses the reader can't accept loses only those uses, not the page", async () => {
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "0");
  const card = { product: { name: "Clay", slug: "clay", domain: "clay.com", description: "" }, status: "ACTIVE", headline: "Enrichment tables", note: "" };
  const listed = { ...card, uses: { picks: ["enrich-leads"], other: "score inbound leads" } };
  fetchQuery.mockResolvedValueOnce({
    handle: "owner", displayName: "Owner", bio: "",
    cards: [{ ...card, uses: { picks: ["enrich-leads"], other: "y".repeat(USE_OTHER_MAX + 1) } }, { ...card, uses: "not an object" }, listed],
  });

  const profile = await getPublicProfile("owner");
  expect(profile?.cards.map(entry => entry.uses)).toEqual([undefined, undefined, listed.uses]);
  expect(profile?.cards.map(entry => entry.headline)).toEqual(["Enrichment tables", "Enrichment tables", "Enrichment tables"]);
});

test("a stored card whose credit no longer fits its platform loses only that credit, not the page", async () => {
  vi.stubEnv("PROPER_RESPECT_E2E_REFERENCE", "0");
  const card = { product: { name: "Clay", slug: "clay", domain: "clay.com", description: "" }, status: "ACTIVE", headline: "Enrichment tables", note: "" };
  // R03's bad-URL set as stored handles, beside one good credit.
  const tampered = ["javascript:alert(1)", "data:text/html,x", "ftp://x.com/jack", "https://user:pass@x.com/jack"].map(handle => ({ ...card, credit: { platform: "X", handle } }));
  const good = { ...card, credit: { platform: "PROPER_RESPECT", handle: "lecturesfrom", linked: true } };
  fetchQuery.mockResolvedValueOnce({ handle: "owner", displayName: "Owner", bio: "", cards: [...tampered, { ...card, credit: "jack" }, good] });

  const profile = await getPublicProfile("owner");
  expect(profile?.cards.map(entry => entry.credit)).toEqual([undefined, undefined, undefined, undefined, undefined, good.credit]);
  expect(profile?.cards.map(entry => entry.headline)).toEqual(Array(6).fill("Enrichment tables"));
});
