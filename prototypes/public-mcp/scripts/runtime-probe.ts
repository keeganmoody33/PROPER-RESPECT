import assert from "node:assert/strict";
import { getPublicProfile } from "@/src/data/get-public-profile";
import { projectVisiblePublicProfile } from "@/src/domain/visible-public-profile";
const profile = await getPublicProfile("keegan");
assert(profile);
const visible = projectVisiblePublicProfile(profile);
assert(visible.cards.length > 0);
console.log(JSON.stringify({ mode: process.env.PROPER_RESPECT_E2E_REFERENCE === "1" ? "synthetic" : "anonymous-public", handle: visible.handle, cards: visible.cards.length, bytes: Buffer.byteLength(JSON.stringify(visible)) }));
