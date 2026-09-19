import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MailboxConnectionNotice, MailboxDiscoveryRun, discoveryRunOwnsSearch, type DiscoveryRun } from "../../components/mailbox-discovery-run";

const run: DiscoveryRun = { id: "synthetic-run", status: "RUNNING", phase: "KNOWN_PRODUCTS", phaseAttempts: 3, totalAttempts: 3, pagesRead: 2, messagesRead: 10, retainedRecords: 6, maxAttemptsPerPhase: 100, maxHeaders: 1000, updatedAt: "2026-09-19T12:00:00Z" };
const render = (value: DiscoveryRun | null, connected = true) => renderToStaticMarkup(createElement(MailboxDiscoveryRun, { run: value, connected, busy: false, onStart: () => {}, onControl: () => {} }));

describe("finite mailbox discovery controls", () => {
  test("empty connections explicitly distinguish Google sign-in from mailbox access", () => {
    const text = renderToStaticMarkup(createElement(MailboxConnectionNotice, { loading: false, gmailCount: 0, connectedCount: 0 }));
    expect(text).toContain("No Gmail accounts are connected in this application.");
    expect(text).toContain("Signing in with Google does not grant mailbox access.");
  });
  test("disconnected accounts cannot start reads", () => {
    expect(render(null, false)).toMatch(/disabled=""[^>]*>Start bounded background discovery/);
  });
  test("running, paused and failed searches reserve the context until cancellation", () => {
    for (const status of ["RUNNING", "PAUSED", "FAILED"] as const) expect(discoveryRunOwnsSearch({ ...run, status })).toBe(true);
    for (const status of ["COMPLETE", "LIMIT_REACHED", "CANCELLED"] as const) expect(discoveryRunOwnsSearch({ ...run, status })).toBe(false);
    expect(render(run)).toContain("Pause discovery");
    expect(render(run)).not.toContain("Start another bounded discovery run");
    expect(render({ ...run, status: "PAUSED" })).toContain("Resume discovery");
  });
  test("only retryable failures offer resume", () => {
    for (const failure of ["TEMPORARY", "LEASE_EXPIRED"] as const) expect(render({ ...run, status: "FAILED", failure })).toContain("Resume discovery");
    for (const failure of ["CURSOR_CYCLE", "CURSOR_EXPIRED", "REAUTHORIZE"] as const) {
      const text = render({ ...run, status: "FAILED", failure });
      expect(text).not.toContain("Resume discovery");
      expect(text).toContain("Cancel discovery");
    }
  });
  test("attempt budgets, successful reads and mailbox coverage stay distinct", () => {
    expect(render(run)).toContain("10 headers examined across 2 successful pages");
    expect(render(run)).toContain("15 of 1000 header-attempt budget used");
    expect(render({ ...run, status: "LIMIT_REACHED" })).toContain("Coverage is partial.");
    expect(render({ ...run, status: "COMPLETE" })).toContain("not proof that every product or every period of use was found");
    expect(render(run)).toContain("No bodies or attachments.");
    expect(render(run)).toContain("Unknown senders remain reviewable");
  });
});
