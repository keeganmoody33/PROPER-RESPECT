import { ExactJsonNumber, parseExactJson, type ExactJson } from "../../domain/exact-json.ts";
import { CURSOR_REPORT_LIMITS } from "./types.ts";

export const invalid = () => new Error("Cursor report could not be verified.");
export function object(value: ExactJson | undefined): Record<string, ExactJson> {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof ExactJsonNumber) throw invalid();
  return value;
}
export function text(value: ExactJson | undefined, required = false): string | null {
  if (value === undefined || value === null) { if (required) throw invalid(); return null; }
  if (typeof value !== "string" || value.length > 256 || /[\x00-\x1f\x7f]/.test(value) || (required && !value.trim())) throw invalid();
  return value;
}
export function bool(value: ExactJson | undefined): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") throw invalid();
  return value;
}

/** Expand a bounded nonnegative decimal lexeme without passing through Number. */
export function decimal(value: string): string {
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(value);
  if (!match || value.length > 160) throw invalid();
  const exponent = Number(match[3] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 128) throw invalid();
  const digits = match[1] + (match[2] ?? ""), point = match[1].length + exponent;
  if (digits.length > 128 || point > 128 || digits.length - point > 128) throw invalid();
  const expanded = point <= 0 ? `0.${"0".repeat(-point)}${digits}`
    : point >= digits.length ? digits + "0".repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`;
  const [whole, fraction = ""] = expanded.split(".");
  const integer = whole.replace(/^0+(?=[0-9])/, ""), tail = fraction.replace(/0+$/, "");
  return tail ? `${integer}.${tail}` : integer;
}
export function quantity(value: ExactJson | undefined, integer = false): string | null {
  if (value === undefined || value === null) return null;
  if (!(value instanceof ExactJsonNumber)) throw invalid();
  const result = decimal(value.lexeme);
  if (integer && result.includes(".")) throw invalid();
  return result;
}
export function count(value: ExactJson | undefined, max: number, min = 0): number {
  const result = quantity(value, true);
  if (result === null || BigInt(result) > BigInt(max) || BigInt(result) < BigInt(min)) throw invalid();
  return Number(result);
}
export function epoch(value: ExactJson | undefined, string = false): string {
  const result = string ? text(value, true) : quantity(value, true);
  if (result === null || !/^(0|[1-9][0-9]{0,14})$/.test(result) || BigInt(result) > BigInt("253402300799999")) throw invalid();
  return new Date(Number(result)).toISOString();
}
export function instant(value: unknown): string {
  if (typeof value !== "string") throw invalid();
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match || Number(match[1]) < 1970 || Number(match[2]) < 1 || Number(match[2]) > 12 || Number(match[3]) < 1
    || Number(match[3]) > new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate() || !Number.isFinite(Date.parse(value))) throw invalid();
  const milliseconds = Date.parse(value);
  if (milliseconds < 0 || milliseconds > 253402300799999) throw invalid();
  return new Date(milliseconds).toISOString();
}
export function checkBytes(inputs: readonly string[]) {
  if (!inputs.length || inputs.some(value => typeof value !== "string")
    || inputs.reduce((sum, value) => sum + new TextEncoder().encode(value).length, 0) > CURSOR_REPORT_LIMITS.bytes) throw invalid();
}
export function json(value: string) { return object(parseExactJson(value)); }

/** Strict RFC 4180-style records, including escaped quotes and quoted newlines. */
export function csvRecords(input: string): string[][] {
  checkBytes([input]);
  const value = input.startsWith("\uFEFF") ? input.slice(1) : input;
  const rows: string[][] = [], row: string[] = [];
  let cell = "", quoted = false, closed = false, started = false;
  const field = () => { row.push(cell); cell = ""; closed = false; started = false; if (row.length > 16) throw invalid(); };
  const record = () => { field(); rows.push(row.splice(0)); if (rows.length > CURSOR_REPORT_LIMITS.rows + 1) throw invalid(); };
  for (let offset = 0; offset < value.length; offset++) {
    const ch = value[offset];
    if (quoted) {
      if (ch === '"') {
        if (value[offset + 1] === '"') { cell += '"'; offset++; }
        else { quoted = false; closed = true; }
      } else cell += ch;
    } else if (ch === '"') {
      if (started || closed) throw invalid();
      quoted = true; started = true;
    } else if (ch === ",") field();
    else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && value[++offset] !== "\n") throw invalid();
      record();
    } else { if (closed) throw invalid(); cell += ch; started = true; }
    if (cell.length > 8192) throw invalid();
  }
  if (quoted) throw invalid();
  if (started || closed || cell || row.length) record();
  if (!rows.length) throw invalid();
  return rows;
}
