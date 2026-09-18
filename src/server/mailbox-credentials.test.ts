import { describe, expect, it } from "vitest";
import { encryptMailboxCredential, decryptMailboxCredential } from "./mailbox-credentials";

const keyring = { activeVersion: "2026-09", keys: { "2026-09": Buffer.alloc(32, 7).toString("base64") } };
const context = { ownerId: "owner-A", provider: "GOOGLE" as const, providerAccountId: "opaque-A", generation: 1 };
const tokens = { accessToken: "access-secret", refreshToken: "refresh-secret", expiresAt: 1800000000000 };

describe("owner and generation-bound mailbox credentials", () => {
  it("round trips tokens in the core envelope with fresh 96-bit IVs", () => {
    const first = encryptMailboxCredential(tokens, context, keyring);
    const second = encryptMailboxCredential(tokens, context, keyring);
    expect(first.algorithm).toBe("AES-256-GCM");
    expect(first.keyVersion).toBe("2026-09");
    expect(Buffer.from(first.iv, "base64")).toHaveLength(12);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toContain("access-secret");
    expect(decryptMailboxCredential(first, context, keyring)).toEqual(tokens);
  });

  it.each([
    { ...context, ownerId: "owner-B" }, { ...context, provider: "MICROSOFT" as const },
    { ...context, providerAccountId: "opaque-B" }, { ...context, generation: 2 },
  ])("rejects a copied envelope in another account or generation %#", (other) => {
    const envelope = encryptMailboxCredential(tokens, context, keyring);
    expect(() => decryptMailboxCredential(envelope, other, keyring)).toThrow("Mailbox credentials could not be decrypted.");
  });

  it("rejects ciphertext, tag, IV and key-version tampering without echoing secrets", () => {
    const envelope = encryptMailboxCredential(tokens, context, keyring);
    const altered = Buffer.from(envelope.ciphertext, "base64");
    altered[0] ^= 1;
    const alteredTag = Buffer.from(envelope.ciphertext, "base64");
    alteredTag[alteredTag.length - 1] ^= 1;
    for (const bad of [
      { ...envelope, ciphertext: altered.toString("base64") },
      { ...envelope, ciphertext: alteredTag.toString("base64") },
      { ...envelope, iv: Buffer.alloc(12).toString("base64") },
      { ...envelope, keyVersion: "missing" }, { ...envelope, ciphertext: "SECRET!" },
    ]) expect(() => decryptMailboxCredential(bad, context, keyring)).toThrow("Mailbox credentials could not be decrypted.");
  });

  it("supports retained old keys while new writes use the active version", () => {
    const old = encryptMailboxCredential(tokens, context, keyring);
    const rotated = { activeVersion: "2026-10", keys: { ...keyring.keys, "2026-10": Buffer.alloc(32, 8).toString("base64") } };
    expect(decryptMailboxCredential(old, context, rotated)).toEqual(tokens);
    expect(encryptMailboxCredential(tokens, context, rotated).keyVersion).toBe("2026-10");
    expect(() => decryptMailboxCredential(old, context, { activeVersion: "2026-10", keys: { "2026-10": rotated.keys["2026-10"] } })).toThrow();
  });

  it("rejects invalid keys, generations, credentials and oversized envelopes", () => {
    expect(() => encryptMailboxCredential(tokens, context, { activeVersion: "bad", keys: { bad: "short" } })).toThrow();
    expect(() => encryptMailboxCredential(tokens, { ...context, generation: 0 }, keyring)).toThrow();
    expect(() => encryptMailboxCredential({ ...tokens, expiresAt: NaN }, context, keyring)).toThrow();
    expect(() => encryptMailboxCredential({ ...tokens, accessToken: "\nsecret" }, context, keyring)).toThrow();
    expect(() => encryptMailboxCredential({ ...tokens, refreshToken: "x".repeat(25000) }, context, keyring)).toThrow();
  });
});
