import { load } from "cheerio";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ProductCard } from "../../components/product-card";
import { registerPublicProfileTool, type PublicProfileTool } from "../../components/public-profile-webmcp";
import { projectVisiblePublicProfile } from "../domain/visible-public-profile";
import { publicProfileSchema } from "../domain/public-profile";
import { buildUsageCostReport } from "../domain/usage-cost-report";
import { projectPrivateUsage } from "../domain/private-usage-card";
import fixture from "../../tests/fixtures/claude-native/private-card-synthetic.json";

const usage = projectPrivateUsage(buildUsageCostReport([JSON.stringify(fixture)])).tools[0];
const card = { product: { name: "Claude Code", slug: "claude-code", domain: "claude.com", description: "Synthetic fixture" }, status: "TESTING" as const, headline: "Synthetic relationship", note: "Synthetic note" };
const render = (overrides: Partial<ComponentProps<typeof ProductCard>> = {}) => load(renderToStaticMarkup(createElement(ProductCard, { card, index: 0, audience: "owner", privateUsage: usage, ...overrides })));

test("native details keep independent exact periods, observations and zero/unknown labels", () => {
  const $ = render();
  expect($(".private-usage-preview").text()).toContain("2 independent coverage rows");
  expect($(".private-usage-rows")).toHaveLength(0);
  expect($(".private-native-rows > section")).toHaveLength(2);
  const native = usage.nativeClaude!;
  for (const row of native.rows) {
    expect($(".private-native-rows").text()).toContain(row.quantity);
    expect($(".private-native-rows").text()).toContain(row.period.startUnixNano);
    expect($(".private-native-rows").text()).toContain(row.streamLabel);
    expect($(".private-native-rows").text()).toContain(row.observationLabels[0]);
  }
  const token = $(".private-native-rows > section").first();
  expect(token.text()).not.toContain(native.rows[1].quantity);
  expect(token.text()).toContain("Source estimate (USD)Unknown");
  expect(token.text()).toContain("API-equivalent estimate (USD)Unpriced");
  expect($("details.private-native-observations").attr("open")).toBeUndefined();
  expect($("details.private-native-observations").text()).toContain(fixture.capturedAt);
});

test.each([
  { audience: "visitor" as const }, { audience: undefined }, { displayMode: "brand-preview" as const },
  { card: { ...card, product: { ...card.product, slug: "another-tool" } } },
  { card: { ...card, product: { ...card.product, domain: "other.example.com" } } },
])("native details respect every existing private rendering gate: %j", overrides => {
  const $ = render(overrides);
  expect($(".private-native-usage, .private-usage-preview")).toHaveLength(0);
  for (const row of usage.nativeClaude!.rows) expect($.text()).not.toContain(row.quantity);
});

test.each(["baseline", "conflict"] as const)("native %s source quantities cannot be mistaken for increments", status => {
  const $ = render({ privateUsage: { ...usage, nativeClaude: { ...usage.nativeClaude!, rows: usage.nativeClaude!.rows.map(row => ({ ...row, status })) } } });
  expect($(".private-native-rows").text()).toContain(status === "baseline" ? "not measured increments" : "not measured usage");
});

test("native runtime extras and broken provenance suppress the entire attachment", () => {
  for (const patch of [{ streamDigest: "DO_NOT_RENDER" }, { observationLabels: ["Native observation 99"] }]) {
    const $ = render({ privateUsage: { ...usage, nativeClaude: { ...usage.nativeClaude!, rows: [{ ...usage.nativeClaude!.rows[0], ...patch }] } } });
    expect($(".private-usage-preview, .private-native-usage")).toHaveLength(0);
    expect($.text()).not.toContain("DO_NOT_RENDER");
  }
});

test("public projection and actual WebMCP response exclude attached native evidence", async () => {
  const publicProfile = publicProfileSchema.parse({ handle: "synthetic", displayName: "Synthetic", bio: "", cards: [card] });
  const attached = { ...publicProfile, privateUsage: usage, cards: [{ ...card, privateUsage: usage }] };
  expect(publicProfileSchema.parse(attached)).toEqual(publicProfile);
  const visible = projectVisiblePublicProfile(attached);
  let tool: PublicProfileTool | undefined;
  const cleanup = registerPublicProfileTool({ async registerTool(value) { tool = value; } }, visible);
  expect(tool).toBeDefined();
  const response = JSON.stringify(await tool!.execute({}));
  cleanup();
  expect(response).not.toMatch(/nativeClaude|privateUsage|Native stream|UnixNano/);
  for (const point of fixture.points) {
    expect(response).not.toContain(point.quantity);
    expect(response).not.toContain(point.streamDigest);
  }
});
