import { z } from "zod";

const identity = z.string().trim().min(1).max(512);

// This describes how an original reached us. It does not establish its claim
// strength or attribute the underlying activity to the person collecting it.
export const captureProvenanceSchema = z.object({
  version: z.literal(1),
  route: z.enum(["DIRECT_API", "MCP", "WEBMCP", "BROWSER_AGENT", "UPLOAD", "OWNER_TESTIMONY"]),
  adapter: z.object({ id: identity, version: identity }),
  origin: z.object({
    issuer: identity,
    accountId: identity.optional(),
    recordId: identity.optional(),
    artifactRef: identity.optional(),
  }),
  collector: z.object({ kind: z.enum(["HUMAN", "AGENT", "SYSTEM", "UNKNOWN"]), id: identity.optional() }),
  activityActor: z.object({ kind: z.enum(["HUMAN", "AGENT", "UNKNOWN"]), id: identity.optional() }),
});
