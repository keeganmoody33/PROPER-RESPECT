import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "../../domain/canonical-json.ts";
import { ExactJsonNumber, parseExactJson } from "../../domain/exact-json.ts";
import { NATIVE_LIMITS, NATIVE_MODELS, normalizeNativeDecimal, parseClaudeNativeCapture } from "../../domain/claude-native-evidence.ts";

const invalid = () => new Error("Invalid native Claude metrics.");
type ObjectValue = Record<string, unknown>;
function object(value: unknown, keys: string[]): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof ExactJsonNumber || Object.keys(value).some(key => !keys.includes(key))) throw invalid();
  return value as ObjectValue;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw invalid();
  return value;
}
function string(value: unknown): string {
  if (typeof value !== "string" || value.length > 8192) throw invalid();
  return value;
}
function number(value: unknown): string {
  if (!(value instanceof ExactJsonNumber)) throw invalid();
  return value.lexeme;
}
function zero(value: unknown) {
  if (value !== undefined && number(value) !== "0") throw invalid();
}
function int64(value: unknown): string {
  const text = string(value);
  if (!/^-?(0|[1-9][0-9]{0,18})$/.test(text) || BigInt(text) < -(BigInt(2) ** BigInt(63)) || BigInt(text) >= BigInt(2) ** BigInt(63)) throw invalid();
  return BigInt(text).toString();
}
function double(value: unknown): string {
  const text = number(value);
  // This check bounds the wire double range; retained arithmetic uses the lexeme only.
  if (!Number.isFinite(Number(text)) || (Number(text) === 0 && /[1-9]/.test(text.split(/[eE]/)[0]))) throw invalid();
  return normalizeNativeDecimal(text);
}
function attributes(value: unknown): [string, unknown][] {
  const entries = list(value ?? [], 128).map(item => {
    const entry = object(item, ["key", "value"]), key = string(entry.key);
    if (!key || key.length > 256) throw invalid();
    const data = object(entry.value, ["stringValue", "boolValue", "intValue", "doubleValue"]);
    const fields = Object.keys(data);
    if (fields.length !== 1) throw invalid();
    const kind = fields[0], raw = data[kind];
    const normalized = kind === "stringValue" ? string(raw) : kind === "intValue" ? int64(raw) : kind === "doubleValue" ? double(raw) : raw;
    if (kind === "boolValue" && typeof raw !== "boolean") throw invalid();
    return [key, { [kind]: normalized }] as [string, unknown];
  }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (new Set(entries.map(([key]) => key)).size !== entries.length) throw invalid();
  return entries;
}
const attributeString = (attrs: [string, unknown][], key: string): string | null => {
  const value = attrs.find(([name]) => name === key)?.[1] as ObjectValue | undefined;
  return typeof value?.stringValue === "string" ? value.stringValue : null;
};

/** Bounded OTLP/HTTP JSON subset. No file, network, logging or configuration effects. */
export function sanitizeClaudeNativeMetrics(body: Uint8Array, options: {
  contentType: string; identityKey: Uint8Array; sourceScope: string;
  sample: "synthetic" | "owner-supplied"; capturedAt: string;
}) {
  try {
    if (!(body instanceof Uint8Array) || body.length > NATIVE_LIMITS.bytes || !options ||
      Object.keys(options).some(key => !["contentType", "identityKey", "sourceScope", "sample", "capturedAt"].includes(key)) ||
      !/^application\/json(?:;\s*charset=utf-8)?$/i.test(options.contentType) ||
      !(options.identityKey instanceof Uint8Array) || options.identityKey.length !== 32 ||
      typeof options.sourceScope !== "string" || !options.sourceScope.length || options.sourceScope.length > 256) throw invalid();
    const keyed = (domain: string, value: unknown) => [...hmac(sha256, options.identityKey,
      new TextEncoder().encode(canonicalJson(["claude-native-v1", domain, value])))].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const root = object(parseExactJson(new TextDecoder("utf-8", { fatal: true }).decode(body)), ["resourceMetrics"]);
    const points = [];
    for (const resourceItem of list(root.resourceMetrics, 32)) {
      const resourceMetric = object(resourceItem, ["resource", "scopeMetrics", "schemaUrl"]);
      const resource = object(resourceMetric.resource ?? {}, ["attributes", "droppedAttributesCount"]);
      zero(resource.droppedAttributesCount);
      const resourceAttrs = attributes(resource.attributes);
      if (attributeString(resourceAttrs, "service.name") !== "claude-code") throw invalid();
      const version = attributeString(resourceAttrs, "service.version");
      const sourceVersion = version && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version) ? version : null;
      for (const scopeItem of list(resourceMetric.scopeMetrics, 32)) {
        const scopeMetric = object(scopeItem, ["scope", "metrics", "schemaUrl"]);
        const scope = object(scopeMetric.scope ?? {}, ["name", "version", "attributes", "droppedAttributesCount"]);
        zero(scope.droppedAttributesCount);
        const scopeIdentity = { name: string(scope.name ?? ""), version: string(scope.version ?? ""), attributes: attributes(scope.attributes) };
        for (const metricItem of list(scopeMetric.metrics, 128)) {
          const metric = object(metricItem, ["name", "description", "unit", "sum"]);
          const name = string(metric.name);
          if (!["claude_code.token.usage", "claude_code.cost.usage"].includes(name)) throw invalid();
          if (metric.description !== undefined) string(metric.description);
          const cost = name === "claude_code.cost.usage";
          if (metric.unit !== (cost ? "USD" : "tokens")) throw invalid();
          const sum = object(metric.sum, ["dataPoints", "aggregationTemporality", "isMonotonic"]);
          const mode = number(sum.aggregationTemporality);
          if (!["1", "2"].includes(mode) || sum.isMonotonic !== true) throw invalid();
          for (const pointItem of list(sum.dataPoints, NATIVE_LIMITS.points)) {
            if (points.length >= NATIVE_LIMITS.points) throw invalid();
            const point = object(pointItem, ["attributes", "startTimeUnixNano", "timeUnixNano", "asInt", "asDouble", "exemplars", "flags"]);
            zero(point.flags);
            if (point.exemplars !== undefined) list(point.exemplars, 128); // Discard all exemplar contents.
            const attrs = attributes(point.attributes);
            const category = attributeString(attrs, "type");
            if (!cost && !["input", "output", "cacheRead", "cacheCreation"].includes(category ?? "")) throw invalid();
            if (Object.hasOwn(point, "asInt") === Object.hasOwn(point, "asDouble")) throw invalid();
            const quantity = Object.hasOwn(point, "asInt") ? int64(point.asInt) : double(point.asDouble);
            if (quantity.startsWith("-") || (!cost && quantity.includes("."))) throw invalid();
            const identity = { sourceScope: options.sourceScope, resource: resourceAttrs,
              resourceSchemaUrl: string(resourceMetric.schemaUrl ?? ""), scope: scopeIdentity,
              scopeSchemaUrl: string(scopeMetric.schemaUrl ?? ""), name, unit: metric.unit,
              type: "monotonic-sum", attributes: attrs };
            const model = attributeString(attrs, "model");
            const temporality = mode === "1" ? "delta" : "cumulative";
            points.push({ streamDigest: keyed("stream", { ...identity, temporality }), familyDigest: keyed("family", identity),
              metric: cost ? "sourceCostUsd" : category, model: model && (NATIVE_MODELS as readonly string[]).includes(model) ? model : null,
              sourceVersion, temporality, startUnixNano: string(point.startTimeUnixNano), endUnixNano: string(point.timeUnixNano), quantity });
          }
        }
      }
    }
    return parseClaudeNativeCapture(JSON.stringify({ format: "claude-code-native-metrics-v1", sample: options.sample,
      capturedAt: options.capturedAt, keyScopeDigest: keyed("key-scope", options.sourceScope), points }));
  } catch { throw invalid(); }
}
