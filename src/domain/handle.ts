import { z } from "zod";

export const handleSchema = z
  .string()
  .trim()
  .min(1)
  .max(39)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);

// Handles no one can claim, because the site's own routes answer at those paths.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "api",
  "admin",
  "icon",
  "apple-icon",
  "evidence-fixture",
  "agents",
  "auth",
  "index",
  "onboarding",
  "sign-in",
  "sign-up",
  "app",
  "about",
  // Held for pages that are planned: search, a page per tool, and browsing people.
  "search",
  "tools",
  "people",
  "explore",
]);
