import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import ProfilePage from "@/app/[handle]/page";
import { getPublicProfile, PublicProfilePayloadError } from "@/src/data/get-public-profile";

vi.mock("@/src/data/get-public-profile", async importOriginal => ({
  ...(await importOriginal<typeof import("@/src/data/get-public-profile")>()),
  getPublicProfile: vi.fn(),
}));
afterEach(() => { vi.resetAllMocks(); });

// Next's notFound() throws an error with this digest; the page renders it as a 404.
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
const render = (handle: string) => ProfilePage({ params: Promise.resolve({ handle }) });

describe("public profile page", () => {
  it("does not add a route-level loading.tsx that would stream 200 before notFound()", () => {
    expect(existsSync(new URL("../../app/[handle]/loading.tsx", import.meta.url))).toBe(false);
  });

  it("renders a published profile without a ProfileLoading fallback", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      handle: "owner",
      displayName: "Owner",
      bio: "Published.",
      cards: [],
    });
    const html = renderToStaticMarkup(await render("owner"));
    expect(html).toContain("Owner");
    expect(html).not.toContain("PROFILE · LOADING");
    expect(html).not.toContain("Loading shared product collection");
  });

  it("renders an absent profile as a 404", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue(null);
    await expect(render("owner")).rejects.toMatchObject({ digest: NOT_FOUND });
  });

  it.each([
    ["a malformed payload", new PublicProfilePayloadError()],
    ["a validation error from elsewhere", new ZodError([])],
    ["a transport failure", new Error("Convex transport failed")],
  ])("lets %s reach the error page instead of a 404", async (_label, failure) => {
    vi.mocked(getPublicProfile).mockRejectedValue(failure);
    const error = await render("owner").then(() => undefined, (reason: unknown) => reason);
    expect(error).toBe(failure);
    expect(error).not.toMatchObject({ digest: NOT_FOUND });
  });
});
