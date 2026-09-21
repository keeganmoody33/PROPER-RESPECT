// 2026-09-21: synthetic identity and form interactions; no account writes.
import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

const compiled = buildSync({
  stdin: { contents: `import {createElement as h} from "react"; import {createRoot} from "react-dom/client";
    import {ProfileLinksFields} from "./components/profile-links-fields";
    import {ProfileName, ProfileLinks} from "./components/profile-identity";
    const profile={handle:"synthetic",displayName:"Synthetic owner",bio:"",cards:[],profileLinks:[{label:"Website",url:"https://example.com/me"}],preferredLinkUrl:"https://example.com/me"};
    createRoot(document.getElementById("root")).render(h("div",null,
      h("h1",null,h(ProfileName,{profile})),h(ProfileLinks,{profile}),
      h("h2",null,h(ProfileName,{profile:{...profile,displayName:"No chosen destination",preferredLinkUrl:undefined}})),
      h("h2",null,h(ProfileName,{profile:{...profile,displayName:"Unlisted destination",preferredLinkUrl:"https://unlisted.example"}})),
      h("form",{className:"form-grid",onSubmit:e=>{e.preventDefault(); document.getElementById("submitted").textContent=JSON.stringify([...new FormData(e.currentTarget)]);}},
        h(ProfileLinksFields,{links:profile.profileLinks,preferredLinkUrl:profile.preferredLinkUrl}),h("button",{type:"submit"},"Save fixture")),h("output",{id:"submitted"})));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

for (const width of [1280, 390]) test(`profile link choice and removal preserve explicit destination at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.setContent('<main id="root"></main>');
  await page.addStyleTag({ content: readFileSync("app/globals.css", "utf8") });
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  await expect(page.getByRole("link", { name: "Synthetic owner" })).toHaveAttribute("href", "https://example.com/me");
  await expect(page.getByRole("navigation", { name: "Profile links" }).getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://example.com/me");
  await expect(page.getByRole("heading", { name: "No chosen destination" }).locator("a")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Unlisted destination" }).locator("a")).toHaveCount(0);
  await page.getByRole("button", { name: "Add a profile link" }).click();
  await page.getByLabel("Link 2 label").fill("Social");
  await page.getByLabel("Link 2 URL").fill("https://social.example/me");
  await page.getByRole("radio", { name: "Use for my name" }).nth(1).check();
  await page.getByRole("button", { name: "Remove link 1" }).click();
  await expect(page.getByRole("radio", { name: "Use for my name" })).toBeChecked();
  await page.getByRole("button", { name: "Save fixture" }).click();
  await expect(page.locator("#submitted")).toContainText('["preferredProfileLink","0"]');
  await expect(page.locator("#submitted")).toContainText("https://social.example/me");
  await page.getByRole("button", { name: "Remove link 1" }).click();
  await expect(page.getByRole("radio", { name: "Keep my name as text" })).toBeChecked();
  const radio = await page.getByRole("radio", { name: "Keep my name as text" }).boundingBox();
  expect(radio!.width).toBeLessThan(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
