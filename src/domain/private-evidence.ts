import { z } from "zod";
import { evidenceObservationSchema } from "./evidence-claims";
import { canonicalJson } from "./canonical-json";

export const MAX_PRIVATE_PAYLOAD_BYTES = 64_000;
export const MAX_PRIVATE_OBSERVATIONS = 24;
const sourceUrlSchema = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Source URL must use HTTPS without credentials.");
const privateEvidenceSchema = z
  .strictObject({
    payload: z
      .string()
      .min(1)
      .refine(
        (value) =>
          value.trim().length > 0 &&
          new TextEncoder().encode(value).length <= MAX_PRIVATE_PAYLOAD_BYTES,
        "Provide between 1 and 64,000 bytes of source text.",
      ),
    sourceUrl: sourceUrlSchema.optional(),
    observations: z
      .array(evidenceObservationSchema)
      .min(1)
      .max(MAX_PRIVATE_OBSERVATIONS),
  })
  .superRefine((value, ctx) => {
    for (const observation of value.observations) {
      if (observation.acquisition !== "USER_SUPPLIED")
        ctx.addIssue({
          code: "custom",
          message:
            "Selected copied text and manual transcriptions must be USER_SUPPLIED.",
        });
      if (!value.payload.includes(observation.excerpt))
        ctx.addIssue({
          code: "custom",
          message: "Every excerpt must occur verbatim in the original payload.",
        });
    }
  });
export type PrivateEvidenceInput = z.infer<typeof privateEvidenceSchema>;
export function parsePrivateEvidence(input: unknown): PrivateEvidenceInput {
  return privateEvidenceSchema.parse(input);
}

// Stable canonical content excludes the capture timestamp. Always compare this
// complete string on a hash match: a hash collision must never merge originals.
export function canonicalPrivateEvidence(input: PrivateEvidenceInput): string {
  return canonicalJson(input);
}
export function privateEvidenceIdentity(input: PrivateEvidenceInput): string {
  // FNV-1a content fingerprint, with exact-content collision rejection at intake.
  let hash = BigInt("0xcbf29ce484222325");
  for (const byte of new TextEncoder().encode(
    canonicalPrivateEvidence(input),
  )) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * BigInt("0x100000001b3"));
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
