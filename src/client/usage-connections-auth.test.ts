import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { UsageConnectionsClient } from "../../components/usage-connections-client";

const state = vi.hoisted(() => ({
  clerk: { isLoaded: true, isSignedIn: true, userId: "owner" },
  convex: { isLoading: false, isAuthenticated: true, isRefreshing: false },
  query: vi.fn(() => []),
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => state.clerk }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => state.convex,
  useQuery: state.query,
  useMutation: () => vi.fn(),
  useConvex: () => ({ query: vi.fn() }),
}));
vi.mock("../../components/usage-connections-panel", () => ({ UsageConnectionsPanel: () => createElement("p", null, "Private connections ready") }));
beforeEach(() => {
  state.clerk = { isLoaded: true, isSignedIn: true, userId: "owner" };
  state.convex = { isLoading: false, isAuthenticated: true, isRefreshing: false };
  state.query.mockClear();
});

test("waits for backend authentication even when Clerk is signed in", () => {
  state.convex = { isLoading: true, isAuthenticated: false, isRefreshing: false };
  const html = renderToStaticMarkup(createElement(UsageConnectionsClient));
  expect(state.query).not.toHaveBeenCalled();
  expect(html).toContain("Connecting private account");
});

test("does not query after backend authentication is lost", () => {
  state.convex = { isLoading: false, isAuthenticated: false, isRefreshing: false };
  renderToStaticMarkup(createElement(UsageConnectionsClient));
  expect(state.query).not.toHaveBeenCalled();
});

test("loads connections once both authentication layers are ready", () => {
  expect(renderToStaticMarkup(createElement(UsageConnectionsClient))).toContain("Private connections ready");
  expect(state.query).toHaveBeenCalledOnce();
});

test("does not retain a query when the Clerk account signs out", () => {
  state.clerk.isSignedIn = false;
  expect(renderToStaticMarkup(createElement(UsageConnectionsClient))).toContain("Sign in");
  expect(state.query).not.toHaveBeenCalled();
});

test("preserves the confirmed owner view while the transport refreshes its token", () => {
  state.convex.isRefreshing = true;
  expect(renderToStaticMarkup(createElement(UsageConnectionsClient))).toContain("Private connections ready");
  expect(state.query).toHaveBeenCalledOnce();
});
