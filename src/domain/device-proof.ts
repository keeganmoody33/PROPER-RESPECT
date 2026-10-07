import { z } from "zod";
import { canonicalJson } from "./canonical-json.ts";
import { digest } from "./usage-sync.ts";
import { historyTimestampSchema } from "./connection-history.ts";
const coordinate = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const devicePublicKeySchema = z.strictObject({ kty: z.literal("EC"), crv: z.literal("P-256"), x: coordinate, y: coordinate });
export const devicePrivateKeySchema = devicePublicKeySchema.extend({ d: coordinate });
export type DevicePublicKey = z.infer<typeof devicePublicKeySchema>;
export type DevicePrivateKey = z.infer<typeof devicePrivateKeySchema>;
export const devicePublicKey = (key: DevicePrivateKey): DevicePublicKey => ({ kty: key.kty, crv: key.crv, x: key.x, y: key.y });
export const deviceDigest = (key: DevicePublicKey) => digest(canonicalJson(key));
export type DeviceMessage =
  | { operation: "pair"; code: string }
  | { operation: "status"; grantId: string }
  | { operation: "ingest"; grantId: string; packetId: string };
export type DeviceProof = { issuedAt: string; signature: string };
export const signedMessage = (message: DeviceMessage, issuedAt: string) => canonicalJson({ version: "proper-respect-device-proof-v1", issuedAt, ...message });
export async function verifyDeviceProof(input: { key: DevicePublicKey; proof: DeviceProof; message: DeviceMessage }) {
  try {
    const issuedAt = historyTimestampSchema.parse(input.proof.issuedAt);
    if (Math.abs(Date.now() - Date.parse(issuedAt)) > 30_000 || !/^[a-f0-9]{128}$/.test(input.proof.signature)) throw new Error();
    const signature = Uint8Array.from(input.proof.signature.match(/../g) ?? [], byte => parseInt(byte, 16));
    const key = await crypto.subtle.importKey("jwk", devicePublicKeySchema.parse(input.key), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, new TextEncoder().encode(signedMessage(input.message, issuedAt)))) throw new Error();
  } catch { throw new Error("Device proof unavailable."); }
}
