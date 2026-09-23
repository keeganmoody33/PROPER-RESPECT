import { expect, test, type Page } from "@playwright/test";

type NativeTool = {
  name: string;
  description: string;
  inputSchema: unknown;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
};
type NativeModelContext = {
  getTools(): Promise<NativeTool[]>;
  executeTool(tool: NativeTool, input: unknown): Promise<string>;
};
type NativeDocument = Document & { modelContext?: NativeModelContext };
type RetainedWindow = Window & { nativeWebMcpTest?: { sentinel: string; tool: NativeTool } };
type Execution = { returned: true; value: unknown } | { returned: false; error: string };
const toolName = "get_current_public_profile";
const guideName = "get_public_site_guide";

async function tools(page: Page): Promise<NativeTool[]> {
  return page.evaluate(async () => {
    const context = (document as NativeDocument).modelContext;
    if (!context) throw new Error("Native document.modelContext is unavailable. Use installed Chrome with the WebMCP preview flags.");
    const registrations = await context.getTools();
    return registrations.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: typeof tool.inputSchema === "string" ? JSON.parse(tool.inputSchema) : tool.inputSchema,
      annotations: tool.annotations,
    }));
  });
}

async function invoke(page: Page, input: unknown = {}, retained = false, selectedName = toolName): Promise<Execution> {
  return page.evaluate(async ({ input, retained, toolName }) => {
    const context = (document as NativeDocument).modelContext;
    if (!context) throw new Error("Native document.modelContext is unavailable.");
    const tool = retained
      ? (window as RetainedWindow).nativeWebMcpTest?.tool
      : (await context.getTools()).find(candidate => candidate.name === toolName);
    if (!tool) throw new Error("Expected native registration is missing.");
    let raw: string;
    try {
      raw = await context.executeTool(tool, input);
    } catch {
      // Chrome preview requires a JSON string; the standard accepts an object.
      try {
        raw = await context.executeTool(tool, JSON.stringify(input));
      } catch (error) {
        return { returned: false as const, error: String(error) };
      }
    }
    try {
      return { returned: true as const, value: JSON.parse(raw) as unknown };
    } catch {
      return { returned: true as const, value: raw };
    }
  }, { input, retained, toolName: selectedName });
}

async function expectProfileTool(page: Page) {
  await expect.poll(() => tools(page)).toHaveLength(1);
  const [tool] = await tools(page);
  expect(tool.name).toBe(toolName);
  return tool;
}

async function expectHydratedShell(page: Page) {
  await expect(async () => {
    await page.locator(".site-header").getByRole("combobox", { name: "Appearance" }).selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "dark");
    await expect(page.locator(".site-footer").getByRole("combobox", { name: "Appearance" })).toHaveValue("dark");
  }).toPass({ timeout: 10_000 });
}

test("native Chrome lists and executes only the visible published profile", async ({ page }, testInfo) => {
  await page.goto("/keegan");
  await expect(page.getByRole("heading", { level: 1, name: "Keegan Moody" })).toBeVisible();
  const tool = await expectProfileTool(page);
  expect(tool.description).toBe("Returns only the published profile and its evidence caveats—the same information visitors can see.");
  expect(tool.inputSchema).toEqual({ type: "object", properties: {}, additionalProperties: false });
  expect(tool.annotations).toMatchObject({ readOnlyHint: true, untrustedContentHint: true });
  const execution = await invoke(page);
  expect(execution).toMatchObject({
    returned: true,
    value: {
      handle: "keegan",
      displayName: "Keegan Moody",
      cards: [
        {
          product: { name: "GitHub" },
          activity: {
            kind: "contributionCalendar",
            total: { displayValue: "523", label: "contributions" },
            memberSinceYear: "2024",
            capturedOn: "2026-07-26",
            provenanceLabel: "GitHub account",
          },
          cost: { displayAmount: "$12.34", basis: "ESTIMATE", cadence: "MONTHLY", asOf: "2026-07-26" },
        },
        {
          product: { name: "Wispr Flow" },
          activity: {
            primary: { displayValue: "373.7K", unit: "words" },
            freshness: "STALE",
            note: "Measurement period not supplied",
          },
        },
      ],
    },
  });
  const serialized = JSON.stringify(execution);
  expect(serialized).not.toMatch(/"(?:brand|logoUrl|avatarUrl|capturedAt|memberSince)":/);
  expect(serialized).not.toContain("Fixture week");
  expect(serialized).not.toContain("373701");
  await testInfo.attach("native-profile-result.json", {
    body: JSON.stringify({ tool, execution }, null, 2),
    contentType: "application/json",
  });
});

test("native Chrome returns a published profile with zero cards", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1, name: "Existing about owner" })).toBeVisible();
  await expectProfileTool(page);
  expect(await invoke(page)).toMatchObject({
    returned: true,
    value: { handle: "about", cards: [], emptyNote: "No published products yet. Draft and private records stay off this page." },
  });
});

test("native invocation rejects arbitrary handle input instead of reading another profile", async ({ page }) => {
  await page.goto("/keegan");
  await expectProfileTool(page);
  const execution = await invoke(page, { handle: "about" });
  if (execution.returned) {
    expect(execution.value).toEqual({
      error: "Use an empty object {}. This tool reads only the profile on the current page and accepts no handle or other arguments.",
    });
  } else {
    expect(execution.error).toMatch(/schema|input|argument|properties|parameter|invalid/i);
  }
  expect(await invoke(page)).toMatchObject({ returned: true, value: { handle: "keegan" } });
});

for (const path of ["/about/origins", "/about/contact", "/about/privacy", "/app/collection", "/no-such-linker"]) {
  test(`native Chrome has no profile tool at ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    if (path === "/no-such-linker") expect(response?.status()).toBe(404);
    await expect(page.locator("main")).toBeVisible();
    await expectHydratedShell(page);
    expect(await tools(page)).toEqual([]);
  });
}

test("Next Link navigation unregisters old native handles and remounts exactly one tool", async ({ page }) => {
  await page.goto("/keegan");
  await expectProfileTool(page);
  await page.evaluate(async toolName => {
    const context = (document as NativeDocument).modelContext;
    if (!context) throw new Error("Native document.modelContext is unavailable.");
    const tool = (await context.getTools()).find(candidate => candidate.name === toolName);
    if (!tool) throw new Error("Expected native registration is missing.");
    (window as RetainedWindow).nativeWebMcpTest = { sentinel: "same-document", tool };
  }, toolName);

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Origins", exact: true }).click();
  await expect(page).toHaveURL(/\/about\/origins$/);
  await expect(page.getByRole("heading", { level: 1, name: "Giving credit its context" })).toBeVisible();
  expect(await page.evaluate(() => (window as RetainedWindow).nativeWebMcpTest?.sentinel)).toBe("same-document");
  await expect.poll(() => tools(page)).toEqual([]);
  const stale = await invoke(page, {}, true);
  expect(stale.returned).toBe(false);

  await page.locator(".site-header").getByRole("link", { name: "Proper Respect home" }).click();
  await expect(page).toHaveURL("/");
  await expect.poll(async () => (await tools(page)).map(tool => tool.name)).toEqual([guideName]);
  await page.evaluate(async () => {
    const context = (document as NativeDocument).modelContext!;
    const tool = (await context.getTools()).find(tool => tool.name === "get_public_site_guide")!;
    (window as RetainedWindow).nativeWebMcpTest = { sentinel: "same-document", tool };
  });
  await page.getByRole("link", { name: "View Keegan’s shared collection" }).click();
  await expect(page).toHaveURL(/\/keegan$/);
  expect(await page.evaluate(() => (window as RetainedWindow).nativeWebMcpTest?.sentinel)).toBe("same-document");
  await expectProfileTool(page);
  expect(await invoke(page)).toMatchObject({ returned: true, value: { handle: "keegan" } });
  expect((await invoke(page, {}, true, guideName)).returned).toBe(false);
  await page.locator(".site-header").getByRole("link", { name: "Proper Respect home" }).click();
  await expect(page).toHaveURL("/");
  await expect.poll(async () => (await tools(page)).map(tool => tool.name)).toEqual([guideName]);
  expect(await invoke(page, {}, false, guideName)).toMatchObject({ returned: true, value: { name: "Proper Respect" } });
});

test("native homepage guide returns canonical public documentation without networking", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your tools.");
  await expect.poll(async () => (await tools(page)).map(tool => tool.name)).toEqual([guideName]);
  const [guide] = await tools(page);
  expect(guide.description).toBe("Explains Proper Respect, links to public documentation, and describes how to read a supplied published profile.");
  expect(guide.inputSchema).toEqual({ type: "object", properties: {}, additionalProperties: false });
  expect(guide.annotations).toMatchObject({ readOnlyHint: true, untrustedContentHint: false });
  await page.waitForLoadState("networkidle", { timeout: 10_000 });
  const requests: string[] = [];
  await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  const execution = await invoke(page, {}, false, guideName);
  expect(execution).toMatchObject({ returned: true, value: {
    name: "Proper Respect", homepage: "https://public.example/",
    documentation: {
      agents: "https://public.example/agents.md", authentication: "https://public.example/auth.md",
      homepageMarkdown: "https://public.example/index.md", origins: "https://public.example/about/origins.md",
      contact: "https://public.example/about/contact.md", privacy: "https://public.example/about/privacy.md",
    },
    profileReading: { tool: toolName, input: {} },
  } });
  const invalid = await invoke(page, { url: "https://private.invalid", handle: "private" }, false, guideName);
  if (invalid.returned) expect(invalid.value).toEqual({ error: "Use an empty object {}. This tool returns the public site guide and accepts no URL, handle, or other arguments." });
  else expect(invalid.error).toMatch(/schema|input|argument|properties|parameter|invalid/i);
  expect(requests).toEqual([]);
  expect(await invoke(page, {}, false, guideName)).toEqual(execution);
  await testInfo.attach("native-guide-result.json", { body: JSON.stringify({ guide, execution }, null, 2), contentType: "application/json" });
});
