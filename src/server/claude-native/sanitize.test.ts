import { describe, expect, it } from "vitest";
import { sanitizeClaudeNativeMetrics } from "./sanitize.ts";
export const options = { contentType: "application/json", identityKey: new Uint8Array(32).fill(7), sourceScope: "synthetic-device", sample: "synthetic" as const, capturedAt: "2026-09-24T12:00:00.000Z" };
const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });
export function request(value: unknown = "9007199254740993") {
  return { resourceMetrics: [{ resource: { attributes: [attr("service.name", "claude-code"), attr("service.version", "2.1.274"), attr("user.email", "SENSITIVE@example.test")] }, scopeMetrics: [{ scope: { name: "private-scope" }, metrics: [{ name: "claude_code.token.usage", unit: "tokens", sum: { aggregationTemporality: 1, isMonotonic: true, dataPoints: [{ attributes: [attr("type", "input"), attr("model", "claude-haiku-4-5-20251001"), attr("session.id", "SENSITIVE-session")], startTimeUnixNano: "1790244000000000001", timeUnixNano: "1790244000000000002", asInt: value }] } }] }] }] };
}
const sanitize = (input: unknown, overrides = {}) => sanitizeClaudeNativeMetrics(new TextEncoder().encode(typeof input === "string" ? input : JSON.stringify(input)), { ...options, ...overrides });
describe("native privacy boundary", () => {
  it("preserves exact native times and values, removes every sensitive field", () => {
    const capture = sanitize(request());
    expect(capture.points[0].quantity).toBe("9007199254740993");
    expect(capture.points[0].startUnixNano).toBe("1790244000000000001");
    expect(JSON.stringify(capture)).not.toMatch(/SENSITIVE|private-scope|user.email|session.id|synthetic-device/);
  });
  it("preserves precise cost exponent lexemes", () => {
    const text = JSON.stringify(request()).replace('"claude_code.token.usage"', '"claude_code.cost.usage"').replace('"tokens"', '"USD"').replace('"asInt":"9007199254740993"', '"asDouble":1.234567890123456789e-20');
    expect(sanitize(text).points[0].quantity).toBe("0.00000000000000000001234567890123456789");
  });
  it("changes opaque identity for every attribute and local producer scope", () => {
    const a = sanitize(request());
    expect(sanitize(JSON.stringify(request()).replace("SENSITIVE-session", "other")).points[0].streamDigest).not.toBe(a.points[0].streamDigest);
    expect(sanitize(request(), { sourceScope: "other-device" }).points[0].streamDigest).not.toBe(a.points[0].streamDigest);
    expect(sanitize(request(), { identityKey: new Uint8Array(32).fill(8) }).keyScopeDigest).not.toBe(a.keyScopeDigest);
  });
  it("does not expose arbitrary model strings", () => {
    expect(sanitize(JSON.stringify(request()).replace("claude-haiku-4-5-20251001", "SECRET-MODEL")).points[0].model).toBeNull();
  });
  it.each(["application/x-protobuf", "text/plain", "application/grpc"])('rejects content type %s', contentType => {
    expect(() => sanitize(request(), { contentType })).toThrow(/^Invalid native Claude metrics\.$/);
  });
  it.each([
    (s: string) => s.replace('"asInt":"9007199254740993"', '"asInt":"9223372036854775808"'),
    (s: string) => s.replace('"asInt":"9007199254740993"', '"asDouble":0.5'),
    (s: string) => s.replace('"asInt":"9007199254740993"', '"asDouble":1e999999'),
    (s: string) => s.replace('"asInt":"9007199254740993"', '"asInt":"1","asInt":"2"'),
    (s: string) => s.replace('"asInt":"9007199254740993"', '"asInt":"1","asDouble":1'),
    (s: string) => s.replace('"resource":{', '"resource":{"droppedAttributesCount":1,'),
    (s: string) => s.replace('"isMonotonic":true', '"isMonotonic":false'),
    (s: string) => s.replace('"aggregationTemporality":1', '"aggregationTemporality":"DELTA"'),
    (s: string) => s.replace('"1790244000000000001"', '"0"'),
    (s: string) => s.replace('"1790244000000000002"', '"18446744073709551616"'),
    (s: string) => s.replace('"claude_code.token.usage"', '"claude_code.session.count"'),
    (s: string) => s.replace('"asInt":', '"flags":1,"asInt":'),
    (s: string) => s.replace('"session.id"', '"type"'),
  ])("rejects unsafe or unsupported input atomically", mutate => {
    expect(() => sanitize(mutate(JSON.stringify(request())))).toThrow(/^Invalid native Claude metrics\.$/);
  });
  it("rejects invalid UTF8 and oversized input without source diagnostics", () => {
    expect(() => sanitizeClaudeNativeMetrics(new Uint8Array([255]), options)).toThrow(/^Invalid native Claude metrics\.$/);
    expect(() => sanitizeClaudeNativeMetrics(new Uint8Array(256001), options)).toThrow(/^Invalid native Claude metrics\.$/);
  });
});
