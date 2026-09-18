import { describe, expect, it } from "vitest";
import { canRefreshMetric, claimableHandleSchema } from "./onboarding";

describe("claimableHandleSchema", () => {
  it("normalizes a valid handle and rejects reserved public routes", () => {
    expect(claimableHandleSchema.parse("  Keegan-Moody  ")).toBe(
      "keegan-moody",
    );
    expect(() => claimableHandleSchema.parse("onboarding")).toThrow(
      /reserved/i,
    );
  });
});

describe("canRefreshMetric", () => {
  it("permits only the exact approved metric and attribution scope", () => {
    const subscription = {
      metricKey: "github.contributions",
      attributionScope: "PERSONAL" as const,
      refreshCadence: "DAILY" as const,
    };

    expect(
      canRefreshMetric(subscription, {
        metricKey: "github.contributions",
        attributionScope: "PERSONAL",
      }),
    ).toBe(true);
    expect(
      canRefreshMetric(subscription, {
        metricKey: "github.private-repositories",
        attributionScope: "PERSONAL",
      }),
    ).toBe(false);
    expect(
      canRefreshMetric(subscription, {
        metricKey: "github.contributions",
        attributionScope: "ORGANIZATION",
      }),
    ).toBe(false);
    expect(
      canRefreshMetric(
        { ...subscription, revokedAt: "2026-07-26T12:00:00.000Z" },
        {
          metricKey: "github.contributions",
          attributionScope: "PERSONAL",
        },
      ),
    ).toBe(false);
  });
});
