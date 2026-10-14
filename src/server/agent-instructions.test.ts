import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { homepageProvenFacts } from "./agent-discovery";
import { agentInstructions } from "./agent-instructions";

const forbidden = /Wispr|Clay|token spend|live site|already shows|finds affiliate|find affiliate|unstored/i;

function section(markdown: string, heading: string) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  expect(start, marker).toBeGreaterThanOrEqual(0);
  const body = markdown.slice(start);
  const next = body.slice(marker.length).search(/\n## /);
  return next === -1 ? body : body.slice(0, next + marker.length);
}

it("states the three proven profile facts where an agent is told what a published profile can contain", () => {
  const profile = section(agentInstructions(), "Current public interface");
  const skill = section(
    readFileSync(path.join(process.cwd(), "public/agent-plugins/proper-respect/skills/read-public-profile/SKILL.md"), "utf8"),
    "Preserve the meaning of the evidence",
  );
  let profileCursor = 0;
  let skillCursor = 0;
  for (const fact of homepageProvenFacts) {
    const profileAt = profile.indexOf(fact, profileCursor);
    const skillAt = skill.indexOf(fact, skillCursor);
    expect(profileAt, fact).toBeGreaterThanOrEqual(profileCursor);
    expect(skillAt, fact).toBeGreaterThanOrEqual(skillCursor);
    profileCursor = profileAt + fact.length;
    skillCursor = skillAt + fact.length;
  }
  expect(profile).not.toMatch(forbidden);
  expect(skill).not.toMatch(forbidden);
});
