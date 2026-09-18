import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { MailboxProvider } from "./mailbox-oauth";

export type MailboxCredentialContext = Readonly<{
  ownerId: string;
  provider: MailboxProvider;
  providerAccountId: string;
  // The generation being written, not the OAuth state's expected prior generation.
  generation: number;
}>;
export type MailboxKeyring = Readonly<{ activeVersion: string; keys: Readonly<Record<string, string>> }>;
export type MailboxCredential = { accessToken: string; refreshToken: string; expiresAt: number };
export type EncryptedMailboxCredential = {
  algorithm: "AES-256-GCM"; keyVersion: string; ciphertext: string; iv: string;
};

function validateText(value: unknown, max: number): asserts value is string {
  if (typeof value !== "string" || !value || value.length > max || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Invalid mailbox credential data.");
  }
}

function authenticatedContext(context: MailboxCredentialContext, keyVersion: string): Buffer {
  validateText(context.ownerId, 256);
  validateText(context.providerAccountId, 256);
  validateText(keyVersion, 64);
  if ((context.provider !== "GOOGLE" && context.provider !== "MICROSOFT") || !Number.isSafeInteger(context.generation) || context.generation < 1) {
    throw new Error("Invalid mailbox credential context.");
  }
  return Buffer.from(JSON.stringify(["mailbox-credential-v1", keyVersion, context.ownerId, context.provider, context.providerAccountId, context.generation]));
}

function decodeBase64(value: string, max: number): Buffer {
  validateText(value, max);
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error("Invalid credential encoding.");
  return bytes;
}

function keyFor(keyring: MailboxKeyring, version: string): Buffer {
  if (!Object.hasOwn(keyring.keys, version)) throw new Error("Mailbox encryption key unavailable.");
  const key = decodeBase64(keyring.keys[version], 44);
  if (key.length !== 32) throw new Error("Invalid mailbox encryption key.");
  return key;
}

function validateCredential(value: unknown): MailboxCredential {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid mailbox credential data.");
  const credential = value as Record<string, unknown>;
  validateText(credential.accessToken, 32768);
  validateText(credential.refreshToken, 32768);
  if (!Number.isSafeInteger(credential.expiresAt) || (credential.expiresAt as number) <= 0) throw new Error("Invalid mailbox credential expiry.");
  // Retain only the credential fields, never provider response blobs or ID tokens.
  return { accessToken: credential.accessToken, refreshToken: credential.refreshToken, expiresAt: credential.expiresAt as number };
}

/** Server-only key material; never persist or expose the keyring with the envelope. */
export function encryptMailboxCredential(credential: MailboxCredential, context: MailboxCredentialContext, keyring: MailboxKeyring): EncryptedMailboxCredential {
  const keyVersion = keyring.activeVersion;
  const aad = authenticatedContext(context, keyVersion);
  const key = keyFor(keyring, keyVersion);
  const plaintext = Buffer.from(JSON.stringify(validateCredential(credential)));
  // Matches the core's 32 KiB base64 envelope bound, including the GCM tag.
  if (plaintext.length + 16 > 24576) throw new Error("Mailbox credential envelope exceeds its size limit.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return { algorithm: "AES-256-GCM", keyVersion, ciphertext: encrypted.toString("base64"), iv: iv.toString("base64") };
}

/** Build context from the verified account record. Never trust envelope-supplied ownership. */
export function decryptMailboxCredential(envelope: EncryptedMailboxCredential, context: MailboxCredentialContext, keyring: MailboxKeyring): MailboxCredential {
  try {
    if (envelope.algorithm !== "AES-256-GCM") throw new Error("Invalid credential algorithm.");
    const aad = authenticatedContext(context, envelope.keyVersion);
    const key = keyFor(keyring, envelope.keyVersion);
    const iv = decodeBase64(envelope.iv, 16);
    const encrypted = decodeBase64(envelope.ciphertext, 32768);
    if (iv.length !== 12 || encrypted.length <= 16) throw new Error("Invalid credential envelope.");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(encrypted.subarray(-16));
    const plaintext = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
    return validateCredential(JSON.parse(plaintext.toString("utf8")));
  } catch {
    // No provider response, plaintext, key material or crypto implementation detail escapes.
    throw new Error("Mailbox credentials could not be decrypted.");
  }
}
