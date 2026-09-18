import { getFunctionName } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";

const { fetchQuery } = vi.hoisted(() => ({ fetchQuery: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery }));
vi.mock("@/src/env", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" }) }));
import { getPublicProfile } from "./get-public-profile";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

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
