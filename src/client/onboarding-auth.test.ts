import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { OnboardingClient, SharingPreview } from "../../components/onboarding-client";
import { getFunctionName, type FunctionReference } from "convex/server";
import { ProductBrandControls } from "../../components/product-brand-controls";
import type { Id } from "../../convex/_generated/dataModel";

const auth = vi.hoisted(() => ({
  clerkSignedIn: true,
  convex: { isLoading: true, isAuthenticated: false },
  protectedQuery: vi.fn(),
  ownerState: undefined as Record<string, unknown> | undefined,
  brandState: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@clerk/nextjs", () => ({
  Show: ({ children, fallback }: { children: ReactNode; fallback: ReactNode }) =>
    auth.clerkSignedIn ? children : fallback,
  SignInButton: ({ children }: { children: ReactNode }) => children,
  UserButton: () => null,
  useUser: () => ({ user: { fullName: "Test owner", imageUrl: "" } }),
  useAuth: () => ({ getToken: vi.fn() }),
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
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
}));

const render = () => renderToString(createElement(OnboardingClient));

beforeEach(() => {
  auth.clerkSignedIn = true;
  auth.convex = { isLoading: true, isAuthenticated: false };
  auth.protectedQuery.mockClear();
  auth.ownerState = undefined;
  auth.brandState = undefined;
});

test("Clerk sign-in waits for Convex token acceptance before owner queries mount", () => {
  expect(render).not.toThrow();
  expect(auth.protectedQuery).not.toHaveBeenCalled();
});

test("rejected or lost Convex authentication never mounts protected owner queries", () => {
  auth.convex = { isLoading: false, isAuthenticated: false };
  expect(render).not.toThrow();
  expect(auth.protectedQuery).not.toHaveBeenCalled();
});

test("token acceptance and subsequent loss reconcile the owner boundary on each render", () => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  expect(render()).toContain("Loading your profile");
  expect(auth.protectedQuery).toHaveBeenCalledTimes(1);
  auth.protectedQuery.mockClear();
  auth.convex = { isLoading: true, isAuthenticated: false };
  expect(render).not.toThrow();
  expect(auth.protectedQuery).not.toHaveBeenCalled();
});

test("a signed-out Clerk session retains the existing sign-in entry", () => {
  auth.clerkSignedIn = false;
  expect(render()).toContain("Sign in or create account");
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

test("private collection and simple owner-described product entry precede optional sharing identity", () => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = {
    user: { handle: "pending-owner", displayName: "Owner", bio: "" },
    cards: [], connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
  };
  const html = render();
  expect(html).toContain("Add a product");
  expect(html.indexOf("Add a product")).toBeLessThan(html.indexOf("Public identity"));
  expect(html).toContain("No integration or activity measurement is required");
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

test("sharing keeps the stored GitHub website until the owner opts into the private account page", () => {
  auth.convex = { isLoading: false, isAuthenticated: true };
  auth.ownerState = {
    user: { handle: "owner", displayName: "Owner", bio: "" },
    cards: [{
      prop: { _id: "github-prop", visibility: "PRIVATE", status: "ACTIVE", headline: "Private GitHub", note: "Owner statement", relationshipVersion: 1 },
      product: { slug: "github", name: "GitHub", domain: "github.com", description: "Code" },
      links: [{ type: "CANONICAL", url: "https://github.com", label: "Check out GitHub", isPrimary: true }],
      claims: [],
      associatedAccountEvidence: [{
        relationshipOwnerId: "owner-user",
        evidenceOwnerId: "owner-user",
        productSlug: "github",
        accountId: "synthetic-account",
        url: "https://github.com/synthetic-account",
      }],
    }],
    connectors: [], drafts: [], evidence: [], privateInventoryAvailable: true,
  };
  const html = render();
  expect(html).toContain('value="https://github.com"');
  expect(html).toContain("https://github.com/synthetic-account");
  expect(html).toContain("Use the private account page in this preview");
  expect(html).toContain("Visitors will use the primary link above until you choose otherwise and approve a preview.");
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
  expect(html).toContain("Owner-selected go-to");
  expect(html).toContain("An explicitly shared footer.");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Publish this preview/);
  expect(html).not.toContain("Private candidate");
});
