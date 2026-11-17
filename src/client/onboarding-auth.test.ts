import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { OnboardingClient } from "../../components/onboarding-client";
import { SharingPreview } from "../../components/sharing-preview";
import { getFunctionName, type FunctionReference } from "convex/server";
import { ProductBrandControls } from "../../components/product-brand-controls";
import type { Id } from "../../convex/_generated/dataModel";

const auth = vi.hoisted(() => ({
  clerkSignedIn: true,
  clerkLoaded: true,
  convex: { isLoading: true, isAuthenticated: false },
  protectedQuery: vi.fn(),
  ownerState: undefined as Record<string, unknown> | undefined,
  brandState: undefined as Record<string, unknown> | undefined,
  accountRows: [] as Array<Record<string, unknown>>,
  accountStatus: "Exhausted",
  sharingStatus: "Exhausted",
}));

vi.mock("@clerk/nextjs", () => ({
  Show: ({ children, fallback }: { children: ReactNode; fallback: ReactNode }) =>
    auth.clerkSignedIn ? children : fallback,
  SignInButton: ({ children }: { children: ReactNode }) => children,
  UserButton: () => null,
  useUser: () => ({ user: { fullName: "Test owner", imageUrl: "" } }),
  useAuth: () => ({ isLoaded: auth.clerkLoaded, getToken: vi.fn() }),
  useClerk: () => ({ openUserProfile: vi.fn() }),
}));

vi.mock("convex/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("convex/react")>(),
  useConvexAuth: () => auth.convex,
  useConvex: () => ({ query: vi.fn() }),
  useQuery: (...args: unknown[]) => {
    auth.protectedQuery(...args);
    if (!auth.convex.isAuthenticated) throw new Error("Authentication required.");
    const name = getFunctionName(args[0] as FunctionReference<"query">);
    return name === "onboarding:getState" ? auth.ownerState : name === "productBrands:getForProp" ? auth.brandState : undefined;
  },
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
  usePaginatedQuery: (reference: FunctionReference<"query">) => getFunctionName(reference) === "inventory:accountEvidencePage"
    ? { results: auth.accountRows, status: auth.accountStatus, loadMore: vi.fn() }
    : { results: getFunctionName(reference) === "onboarding:sharingCards" ? auth.ownerState?.cards ?? [] : [], status: getFunctionName(reference) === "onboarding:sharingCards" ? auth.sharingStatus : "Exhausted", loadMore: vi.fn() },
}));

const render = () => renderToString(createElement(OnboardingClient, { publicOrigin: "https://canonical.example" }));

beforeEach(() => {
  auth.clerkSignedIn = true;
  auth.clerkLoaded = true;
  auth.convex = { isLoading: true, isAuthenticated: false };
  auth.protectedQuery.mockClear();
  auth.ownerState = undefined;
  auth.brandState = undefined;
  auth.accountRows = [];
  auth.accountStatus = "Exhausted";
  auth.sharingStatus = "Exhausted";
});

test("Clerk sign-in waits for Convex token acceptance before owner queries mount", () => {
  expect(render()).toContain("Verifying your session");
  expect(auth.protectedQuery).not.toHaveBeenCalled();
});

test("rejected or lost Convex authentication never mounts protected owner queries", () => {
  auth.convex = { isLoading: false, isAuthenticated: false };
  expect(render()).toContain("Could not verify your session");
  expect(auth.protectedQuery).not.toHaveBeenCalled();
});

test("token acceptance and subsequent loss reconcile the owner boundary on each render", () => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  expect(render()).toContain("Loading your profile");
  expect(auth.protectedQuery).toHaveBeenCalledTimes(1);
  auth.protectedQuery.mockClear();
  auth.convex = { isLoading: true, isAuthenticated: false };
  expect(render()).toContain("Verifying your session");
  expect(auth.protectedQuery).not.toHaveBeenCalled();
});

test("a signed-out Clerk session leads with the stack builder and keeps the usage-data sign-in entry", () => {
  auth.clerkSignedIn = false;
  const html = render();
  expect(html).toContain("<h1>Start your collection</h1>");
  expect(html).toContain("Sign in to save 0 tools</button>");
  expect(html).toContain("Already have usage data?</h2>");
  expect(html).toContain(">Sign in</button>");
  expect(auth.protectedQuery).not.toHaveBeenCalled();
});

test("before Clerk knows the session, the builder shell renders and nothing can be saved yet", () => {
  auth.clerkLoaded = false;
  const html = render();
  expect(html).toContain("<h1>Start your collection</h1>");
  expect(html).toContain("Checking your session…</button>");
  expect(html).not.toContain("Sign in to save");
  expect(auth.protectedQuery).not.toHaveBeenCalled();
});

test.each([false, true])("private cards query brands only when the backend advertises support (%s)", (available) => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = {
    user: { handle: "owner", displayName: "Owner", bio: "" },
    cards: [{
      prop: { _id: "private-prop", visibility: "DRAFT", status: "TESTING", headline: "Private candidate", note: "" },
      product: { slug: "wisprflow", name: "Wispr Flow", domain: "wisprflow.ai", description: "Dictation" },
      links: [], claims: [],
    }],
    connectors: [], drafts: [], evidence: [],
    ...(available ? { brandEnrichmentAvailable: true } : {}),
  };
  expect(render()).toContain("Wispr Flow");
  const brandQueries = auth.protectedQuery.mock.calls.filter(call => getFunctionName(call[0] as FunctionReference<"query">) === "productBrands:getForProp");
  expect(brandQueries).toHaveLength(available ? 1 : 0);
});

test.each(["PENDING", "RUNNING"])("a stranded %s brand job keeps an explicit retry available", (status) => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.brandState = { status, current: null };
  const html = renderToString(createElement(ProductBrandControls, { propId: "private-prop" as Id<"props"> }));
  expect(html).toContain("Retry brand identity");
  expect(html).not.toMatch(/<button[^>]*disabled/);
});

const firstRunSections = ['id="build-stack"', 'id="private-collection-title"', 'id="add-product"', 'id="collection-profile"', 'id="collection-sharing"', 'id="collection-sources"'];

test.each([
  { label: "no handle yet", claimed: false, published: false },
  { label: "a draft handle", claimed: true, published: false },
  { label: "a published handle", claimed: true, published: true },
])("the first run reads stack, collection, handle, sharing, then sources with $label", ({ claimed, published }) => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = {
    user: { _id: "owner", handle: claimed ? "maya-ops" : "pending-owner", displayName: "Owner", bio: "" },
    cards: [], connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
    hasClaimedPublicIdentity: claimed, hasPublicationAtCurrentHandle: published,
  };
  const html = render();
  const navigationStart = html.indexOf('<nav class="collection-navigation"');
  const navigation = html.slice(navigationStart, html.indexOf("</nav>", navigationStart));
  expect(navigation.split('href="#').slice(1).map(link => link.slice(0, link.indexOf('"')))).toEqual(["build-stack", "private-collection-title", "add-product", "collection-profile", "collection-sharing", "collection-sources"]);
  const main = html.slice(html.indexOf("</nav>", navigationStart));
  const positions = firstRunSections.map(marker => main.indexOf(marker));
  expect(positions.every(position => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  // The source picker sits with the sources, below sharing, never above the stack.
  expect(main.indexOf('aria-label="Choose what to bring in"')).toBeGreaterThan(main.indexOf('id="collection-sources"'));
  const step = main.slice(main.indexOf('id="collection-profile"'), main.indexOf('id="collection-sharing"'));
  if (claimed) {
    expect(step).toContain(published ? ">https://canonical.example/maya-ops</a>" : "https://canonical.example/maya-ops");
    expect(step).not.toContain("pending-owner");
  } else {
    // With no handle, the field is the step itself: not folded into a disclosure, and no placeholder address.
    const handleAt = step.indexOf('name="handle"');
    const handleInput = step.slice(step.lastIndexOf("<input", handleAt), step.indexOf(">", handleAt));
    expect(handleInput).toContain('value=""');
    expect(step.slice(0, handleAt)).not.toContain("<details");
    expect(step.slice(0, step.indexOf('name="displayName"'))).not.toContain("<details");
    expect(step).not.toContain("canonical.example/pending-owner");
    // Bio and links stay one tap away in the same form, so saving the handle keeps them.
    expect(step.indexOf("<details")).toBeLessThan(step.indexOf('name="bio"'));
  }
  expect(step.split("<form").length - 1).toBe(1);
});

test("private collection and simple owner-described product entry precede optional sharing identity", () => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = {
    user: { handle: "pending-owner", displayName: "Owner", bio: "" },
    cards: [], connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
  };
  const html = render();
  expect(html).toContain("Add a tool");
  expect(html.indexOf("Add a tool")).toBeLessThan(html.indexOf('id="collection-profile"'));
  expect(html).toContain("Name a tool and choose how you use it.");
  expect(html).not.toContain('name="slug"');
  expect(html).not.toMatch(/name="website"[^>]*required/);
  expect(html).toContain("Preview sharing");
  expect(html).not.toContain("Publish selected cards");
  expect(html).not.toContain('name="primaryMetric"');
  expect(html).toContain("Files are not parsed or unpacked automatically");
  expect(html).toMatch(/accept="[^"]*\.json,[^"]*\.xlsx,[^"]*\.zip"[^>]*name="evidence"/);
  expect(html).toContain('<option value="Devin">Devin (cloud)</option>');
  expect(html).toContain('<option>Devin Desktop</option>');
});

test.each(["Exhausted", "CanLoadMore"])("sharing requires complete account coverage and owner opt-in (%s)", (status) => {
  auth.accountStatus = status;
  auth.accountRows = [{ connected: false, candidate: { sourceDay: "2026-09-21", accountKey: "synthetic-account", evidence: { relationshipOwnerId: "owner-user", evidenceOwnerId: "owner-user", productSlug: "github", accountId: "synthetic-account", url: "https://github.com/synthetic-account" } } }];
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = {
    user: { handle: "owner", displayName: "Owner", bio: "" },
    cards: [{
      prop: { _id: "github-prop", visibility: "PRIVATE", status: "ACTIVE", headline: "Private GitHub", note: "Owner statement", relationshipVersion: 1 },
      product: { slug: "github", name: "GitHub", domain: "github.com", description: "Code" },
      links: [{ type: "CANONICAL", url: "https://github.com", label: "Check out GitHub", isPrimary: true }],
      claims: [],
      associatedAccountEvidence: [],
    }],
    connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
  };
  const html = render();
  expect(html).toContain('value="https://github.com"');
  if (status === "CanLoadMore") {
    expect(html).toContain("Account lookup incomplete");
    expect(html).not.toContain("Use the private account page in this preview");
    expect(html).not.toContain("https://github.com/synthetic-account");
    return;
  }
  expect(html).toContain("https://github.com/synthetic-account");
  expect(html).toContain("Use the private account page in this preview");
  expect(html).toContain("Visitors will use the primary link above until you choose otherwise and approve a preview.");
  // The default path never offers an affiliate link; it waits behind More options.
  const canonical = html.indexOf("Product or account page");
  const purpose = html.slice(html.lastIndexOf("<select", canonical), html.indexOf("</select>", canonical));
  expect(purpose).not.toContain("affiliate");
  const more = html.indexOf("<summary>More options</summary>");
  expect(more).toBeGreaterThan(canonical);
  expect(html.slice(more, html.indexOf("</details>", more))).toContain("Mark this as my affiliate link");
  expect(html).not.toMatch(/value="https:\/\/github\.com\/synthetic-account"/);
  expect(html).not.toContain("I approve making exactly this preview visible");
});

test("sharing preview renders only the server-projected profile and requires a separate owner approval", () => {
  const profile = {
    handle: "owner", displayName: "Owner", bio: "An explicitly shared footer.", cards: [{
      product: { name: "Shared tool", slug: "shared-tool", domain: "example.com", description: "" },
      status: "ACTIVE" as const, headline: "Approved explanation", note: "Approved note", goTo: true,
    }],
  };
  const html = renderToString(createElement(SharingPreview, { profile, current: true, busy: false, onPublish: vi.fn() }));
  expect(html).toContain("Approved explanation");
  expect(html).toContain(">Go-to<");
  expect(html).toContain("An explicitly shared footer.");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Publish this preview/);
  expect(html).not.toContain("Private candidate");
});

test.each([
  { label: "unpublished current handle", membership: false, publication: false },
  { label: "resolved current publication", membership: true, publication: true },
  { label: "missing backend membership", membership: undefined, publication: undefined },
  { label: "ambiguous retained publication", membership: false, publication: true },
])("sharing labels, checkbox, and public link follow $label", ({ membership, publication }) => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = {
    user: { handle: "current", displayName: "Owner", bio: "" },
    hasClaimedPublicIdentity: true,
    hasPublicationAtCurrentHandle: publication,
    cards: [{
      prop: { _id: "saved-prop", visibility: "PUBLIC", status: "ACTIVE", headline: "Saved relationship", note: "Saved note", relationshipVersion: 1, confirmedAt: "2026-09-19T23:00:00.000Z" },
      product: { slug: "saved-tool", name: "Saved tool", domain: "saved.example", description: "" },
      isPublishedAtCurrentHandle: membership,
      links: [], claims: [],
    }],
    connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
  };
  const html = render().replace(/<!--.*?-->/g, "");
  const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*\/>\s*Share this saved card/)?.[0];
  expect(checkbox).toBeDefined();
  if (membership === true) {
    expect(checkbox).toContain('checked=""');
    expect(html).toContain("Already public at /current.");
    expect(html).toContain("Include saved version");
  } else {
    expect(checkbox).not.toContain('checked=""');
    expect(html).not.toContain("Already public");
    expect(html).not.toContain("Include saved version");
  }
  if (publication === true) {
    expect(html).toMatch(/<a href="\/current"[^>]*>Open current public page/);
    expect(html).toContain("Copy profile link");
  } else {
    expect(html).not.toContain("Open current public page");
    expect(html).not.toContain("Copy profile link");
  }
  if (publication === false) expect(html).toContain("Nothing is published at /current yet.");
  else expect(html).not.toContain("Nothing is published at /current yet.");
});

test("absent identity capability keeps sharing disabled without claiming a public handle", () => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = {
    user: { handle: "current", displayName: "Owner", bio: "" },
    hasPublicationAtCurrentHandle: false,
    cards: [], connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
  };
  const html = render();
  expect(html).toContain("Public identity status is unavailable. Reload before previewing sharing.");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Preview sharing<\/button>/);
  expect(html).toContain("Nothing is published yet.");
  expect(html).not.toContain("Nothing is published at /current yet.");
  expect(html).not.toContain("Set up your public identity");
  expect(html).not.toContain("Open current public page");
});


test("the account shell cannot expose empty sharing controls before the first card page", () => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = { user: { _id: "owner", handle: "owner" }, cards: [], connectors: [], privateInventoryAvailable: true, hasClaimedPublicIdentity: true };
  auth.sharingStatus = "LoadingFirstPage";
  const html = render();
  expect(html).toContain("Loading your profile");
  expect(html).not.toContain("Preview sharing");
  expect(html).not.toContain("See your first private result");
  auth.sharingStatus = "Exhausted";
  expect(render()).toContain("See your first private result");
});
