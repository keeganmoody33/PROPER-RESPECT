import { ConvexError } from "convex/values";
import type { z } from "zod";

// A Convex production deployment redacts a plain Error to "Server Error" and
// the function name. Only a ConvexError's data reaches the client, so every
// message meant for the person travels as data. String data also keeps
// error.message equal to the text on the server.
export function userError(message: string): ConvexError<string> {
  return new ConvexError(message);
}

// Refinements carry the copy written for people. Zod's own wording does not,
// so those failures show the caller's sentence instead.
export function parseOrUserError<T extends z.ZodType>(schema: T, value: unknown, fallback: string): z.output<T> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const custom = parsed.error.issues.find(issue => issue.code === "custom" && issue.message);
  throw userError(custom ? custom.message : fallback);
}

const isConvexError = (error: object): error is { data?: unknown } => Symbol.for("ConvexError") in error;

// The text to show for a caught error. A Convex error's message names the
// function on the client, so only its data is shown; a plain Error from
// Convex is redacted in production and shows the fallback.
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;
  if (isConvexError(error)) {
    const { data } = error;
    if (typeof data === "string" && data) return data;
    if (typeof data === "object" && data !== null && "message" in data && typeof data.message === "string" && data.message) return data.message;
    return fallback;
  }
  if (!(error instanceof Error) || !error.message) return fallback;
  if (error.message.startsWith("[CONVEX ") || error.message.includes("Server Error")) return fallback;
  return error.message;
}
