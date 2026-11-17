import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorMessage, parseOrUserError, userError } from "./user-error";

const FALLBACK = "Your tools were not saved. Your list is unchanged; you can retry.";

describe("userError", () => {
  it("is a ConvexError whose data and message are the person's message", () => {
    const error = userError("That handle is already claimed.");
    expect(error).toBeInstanceOf(ConvexError);
    expect(error.data).toBe("That handle is already claimed.");
    expect(error.message).toBe("That handle is already claimed.");
  });
});

describe("parseOrUserError", () => {
  const HANDLE_MAX = 8;
  const schema = z.string().max(HANDLE_MAX).refine(value => value !== "app", { message: "This handle is reserved." });

  it("returns the parsed value", () => {
    expect(parseOrUserError(schema, "owner", FALLBACK)).toBe("owner");
  });

  it("throws the schema's own message as a user error", () => {
    expect(() => parseOrUserError(schema, "app", FALLBACK)).toThrow(expect.objectContaining({ name: "ConvexError", data: "This handle is reserved." }));
  });

  it("throws the fallback instead of zod's default wording", () => {
    expect(() => parseOrUserError(schema, "Not A Handle", FALLBACK)).toThrow(expect.objectContaining({ name: "ConvexError", data: FALLBACK }));
  });
});

describe("errorMessage", () => {
  // The browser client wraps a server ConvexError like this: the message names
  // the function, and the person's message is only in data.
  function clientConvexError(data: unknown) {
    const error = new ConvexError("[CONVEX M(onboarding:claimHandle)] [Request ID: 1a2b] Server Error\n  Called by client");
    (error as { data: unknown }).data = data;
    return error;
  }

  it("returns the message a ConvexError carries as data", () => {
    expect(errorMessage(clientConvexError("That handle is already claimed."), FALLBACK)).toBe("That handle is already claimed.");
  });

  it("returns a message carried as { message } data", () => {
    expect(errorMessage(clientConvexError({ message: "Use a bio of 500 characters or fewer." }), FALLBACK)).toBe("Use a bio of 500 characters or fewer.");
  });

  it("returns the fallback when ConvexError data carries no message", () => {
    expect(errorMessage(clientConvexError({ code: "LIMIT" }), FALLBACK)).toBe(FALLBACK);
  });

  it("returns a plain Error's own message", () => {
    expect(errorMessage(new Error("This file is not valid JSON. Check the sanitized export and try again."), FALLBACK))
      .toBe("This file is not valid JSON. Check the sanitized export and try again.");
  });

  it("returns the fallback, never a function name, for a redacted production error", () => {
    const redacted = new Error("[CONVEX M(onboarding:publishSelections)] [Request ID: 9f8e7d] Server Error\n  Called by client");
    const shown = errorMessage(redacted, FALLBACK);
    expect(shown).toBe(FALLBACK);
    expect(shown).not.toContain("onboarding:");
    expect(shown).not.toContain("Server Error");
  });

  it("returns the fallback for a bare Server Error message", () => {
    expect(errorMessage(new Error("Server Error"), FALLBACK)).toBe(FALLBACK);
  });

  it("returns the fallback for anything that is not an Error", () => {
    expect(errorMessage("boom", FALLBACK)).toBe(FALLBACK);
    expect(errorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });
});
