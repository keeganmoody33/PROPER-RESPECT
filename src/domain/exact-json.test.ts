import { describe, expect, it } from "vitest";
import { ExactJsonNumber, parseExactJson } from "./exact-json.ts";
describe("bounded exact JSON", () => {
  it("retains numeric lexemes without binary rounding", () => {
    expect(parseExactJson('{"n":9007199254740993,"d":1.000000000000000001e-20}')).toEqual({ n: new ExactJsonNumber("9007199254740993"), d: new ExactJsonNumber("1.000000000000000001e-20") });
  });
  it.each(['{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '[1,]', '{"a":}', '01', 'NaN', '"\\ud800"', '"\ud800"', '['.repeat(40)+']'.repeat(40), '{"secret":'])('rejects malformed input with no excerpt', text => {
    expect(() => parseExactJson(text)).toThrow(/^Invalid exact JSON\.$/);
  });
  it("treats prototype keys as ordinary own keys", () => {
    const result = parseExactJson('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    expect(Object.getPrototypeOf(result)).toBe(null);
    expect(Object.keys(result)).toEqual(["__proto__"]);
  });
});

it("allows bounded long source strings only when explicitly requested", () => {
  const text = JSON.stringify({ content: "x".repeat(9000), count: 1 });
  expect(() => parseExactJson(text)).toThrow();
  expect(() => parseExactJson(text, { maxStringLength: 256_000 })).not.toThrow();
  expect(() => parseExactJson(text, { maxStringLength: 256_001 })).toThrow();
});
