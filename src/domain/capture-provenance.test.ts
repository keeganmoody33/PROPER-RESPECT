import { expect, test } from "vitest";
import { rawSignalSchema } from "./discovery";

const legacy = { sourceType: "GMAIL", capturedAt: "2026-09-16T00:00:00.000Z", payload: "A signup receipt." };
const provenance = {
  version: 1, route: "MCP", adapter: { id: "mail-reader", version: "1" },
  origin: { issuer: "GOOGLE", accountId: "account-1", recordId: "message-1" },
  collector: { kind: "AGENT" }, activityActor: { kind: "UNKNOWN" },
};

test("raw signals retain explicit capture provenance without inventing legacy or human attribution", () => {
  expect(rawSignalSchema.parse(legacy)).not.toHaveProperty("captureProvenance");
  expect(rawSignalSchema.parse({ ...legacy, captureProvenance: provenance })).toMatchObject({ captureProvenance: provenance });
  expect(rawSignalSchema.safeParse({ ...legacy, captureProvenance: { ...provenance, activityActor: undefined } }).success).toBe(false);
  expect(rawSignalSchema.safeParse({ ...legacy, captureProvenance: { ...provenance, version: 2 } }).success).toBe(false);
});

test("Microsoft mail is a source meaning; MCP and WebMCP are capture routes", () => {
  expect(rawSignalSchema.safeParse({ ...legacy, sourceType: "MICROSOFT_MAIL", captureProvenance: provenance }).success).toBe(true);
  for (const sourceType of ["MCP", "WEBMCP"]) {
    expect(rawSignalSchema.safeParse({ ...legacy, sourceType }).success).toBe(false);
  }
});
