import { describe, expect, it } from "vitest";
import {
  cardStatusLabel, cardTopLine, DEFAULT_STACK_LEVEL, isRelationshipLevel, levelDefinition, levelLabel,
  levelMatchesStatus, levelStatus, RELATIONSHIP_LEVELS, relationshipLevelSchema, relationshipLevelsRule,
} from "./relationship-level";

describe("relationship levels", () => {
  it("lists seven levels cold to hot with their labels, definitions and implied status", () => {
    expect(RELATIONSHIP_LEVELS.map(level => [level.key, level.label, level.definition, level.status])).toEqual([
      ["TRIED_NOT_ADOPTED", "Tried, didn't adopt", "I tried it and decided not to use it.", "ARCHIVED"],
      ["STOPPED", "Stopped using", "I used it for real work and no longer do.", "ARCHIVED"],
      ["PAUSED", "Paused", "I'm not using it now and may come back.", "ARCHIVED"],
      ["OCCASIONAL", "Occasionally", "I reach for it less than once a week, when a job needs it.", "ACTIVE"],
      ["TESTING", "Testing", "I'm evaluating it and haven't decided.", "TESTING"],
      ["WEEKLY", "Weekly", "I use it most weeks.", "ACTIVE"],
      ["DAILY", "Daily", "I use it on most working days.", "ACTIVE"],
    ]);
  });

  it("has no go-to property: a level never decides go-to", () => {
    expect(RELATIONSHIP_LEVELS.map(level => Object.keys(level).sort())).toEqual(
      RELATIONSHIP_LEVELS.map(() => ["definition", "key", "label", "status"]));
  });

  it("looks up status, label and definition by key", () => {
    expect(levelStatus("PAUSED")).toBe("ARCHIVED");
    expect(levelStatus("OCCASIONAL")).toBe("ACTIVE");
    expect(levelStatus("TESTING")).toBe("TESTING");
    expect(levelLabel("STOPPED")).toBe("Stopped using");
    expect(levelDefinition("DAILY")).toBe("I use it on most working days.");
  });

  it("falls back to a status word when a card has no level", () => {
    expect(cardStatusLabel({ status: "ACTIVE" })).toBe("Using");
    expect(cardStatusLabel({ status: "TESTING" })).toBe("Testing");
    expect(cardStatusLabel({ status: "ARCHIVED" })).toBe("Used before");
    expect(cardStatusLabel({ status: "ACTIVE", level: "WEEKLY" })).toBe("Weekly");
  });

  it("rejects an unknown key", () => {
    expect(relationshipLevelSchema.safeParse("RETIRED_LEVEL").success).toBe(false);
    expect(relationshipLevelSchema.safeParse("daily").success).toBe(false);
    expect(relationshipLevelSchema.safeParse("DAILY").data).toBe("DAILY");
    expect(isRelationshipLevel("ARCHIVED")).toBe(false);
    expect(isRelationshipLevel("STOPPED")).toBe(true);
  });

  it("matches a level only with the status it implies", () => {
    expect(levelMatchesStatus("DAILY", "ACTIVE")).toBe(true);
    expect(levelMatchesStatus("DAILY", "ARCHIVED")).toBe(false);
    expect(levelMatchesStatus(undefined, "ARCHIVED")).toBe(true);
  });

  it("writes the card top line with a since-year, except for a tool never adopted", () => {
    expect(cardTopLine({ status: "ACTIVE", level: "DAILY", startedAt: "2021-03-04" })).toBe("Daily · since 2021");
    expect(cardTopLine({ status: "ARCHIVED", level: "STOPPED", startedAt: "2022-01-01" })).toBe("Stopped using · started 2022");
    expect(cardTopLine({ status: "ARCHIVED", level: "TRIED_NOT_ADOPTED", startedAt: "2024-01-01" })).toBe("Tried, didn't adopt");
    expect(cardTopLine({ status: "ARCHIVED", startedAt: "2020-05-05" })).toBe("Used before · started 2020");
    expect(cardTopLine({ status: "ACTIVE" })).toBe("Using");
  });

  it("tells agents every level with its definition and the fallbacks", () => {
    expect(relationshipLevelsRule).toBe("The relationship words on a card are the owner's own choice and are never derived from activity. They name one of seven usage levels, cold to hot: Tried, didn't adopt (I tried it and decided not to use it); Stopped using (I used it for real work and no longer do); Paused (I'm not using it now and may come back); Occasionally (I reach for it less than once a week, when a job needs it); Testing (I'm evaluating it and haven't decided); Weekly (I use it most weeks); Daily (I use it on most working days). A card without a level says Using, Testing or Used before. The order is not a score or a ranking, and go-to is a separate mark.");
  });

  it("defaults new stack picks to Weekly", () => {
    expect(DEFAULT_STACK_LEVEL).toBe("WEEKLY");
  });
});
