import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";

afterEach(() => vi.restoreAllMocks());

const post = (body: string, contentType: string) => POST(new Request("https://public.example/api/csp-report", {
  method: "POST", headers: { "Content-Type": contentType }, body,
}));

it("logs only the violated directive and the blocked origin of a legacy report", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const response = await post(JSON.stringify({ "csp-report": {
    "document-uri": "https://proper-respect.com/private-path?token=SECRET",
    "violated-directive": "script-src-elem", "effective-directive": "script-src-elem",
    "blocked-uri": "https://evil.example/path/SECRET.js?q=SECRET", "original-policy": "SECRET POLICY",
  } }), "application/csp-report");
  expect(response.status).toBe(204);
  expect(warn).toHaveBeenCalledTimes(1);
  const logged = JSON.stringify(warn.mock.calls);
  expect(logged).toContain("script-src-elem");
  expect(logged).toContain("https://evil.example");
  expect(logged).not.toContain("SECRET");
});

it("logs each violation of a Reporting API batch", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const response = await post(JSON.stringify([
    { type: "csp-violation", url: "https://proper-respect.com/x?SECRET", body: { effectiveDirective: "img-src", blockedURL: "https://img.example/SECRET.png", documentURL: "https://proper-respect.com/SECRET" } },
    { type: "csp-violation", body: { effectiveDirective: "script-src", blockedURL: "inline" } },
    { type: "deprecation", body: { message: "SECRET" } },
  ]), "application/reports+json");
  expect(response.status).toBe(204);
  expect(warn).toHaveBeenCalledTimes(2);
  const logged = JSON.stringify(warn.mock.calls);
  expect(logged).toContain("https://img.example");
  expect(logged).toContain("inline");
  expect(logged).not.toContain("SECRET");
});

it.each([
  ["an oversized body", "x".repeat(8193), "application/csp-report"],
  ["malformed JSON", "{not json", "application/csp-report"],
  ["an unrelated shape", JSON.stringify({ hello: "world" }), "application/json"],
])("accepts %s without logging it", async (_label, body, type) => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect((await post(body, type)).status).toBe(204);
  expect(warn).not.toHaveBeenCalled();
});
