#!/usr/bin/env node
// Computes expectedProfileHash for publicationMigration:moveSeededPublication
// (docs/releases/v0.2.0.md): the lowercase hex SHA-256 of
// canonicalJson({ ...profile, handle: "keegan" }), as convex/publicationMigration.ts does.
//
// Usage: node --experimental-strip-types scripts/migration-profile-hash.mjs <file.json> [fromHandle]
// The file holds the publishedProfiles row, or just its `profile` value.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { canonicalJson } from "../src/domain/canonical-json.ts";

const [file, fromHandle = "keegan"] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node --experimental-strip-types scripts/migration-profile-hash.mjs <file.json> [fromHandle]");
  process.exit(1);
}
const stored = JSON.parse(readFileSync(file, "utf8"));
const profile = stored && typeof stored === "object" && "profile" in stored ? stored.profile : stored;
if (!profile || typeof profile !== "object" || !Array.isArray(profile.cards)) {
  console.error("The file must hold a publishedProfiles row or its profile, with a cards array.");
  process.exit(1);
}
console.log(createHash("sha256").update(canonicalJson({ ...profile, handle: fromHandle })).digest("hex"));
