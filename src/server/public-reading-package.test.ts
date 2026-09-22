import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const packageRoot = path.join(repositoryRoot, "public/agent-plugins/proper-respect");
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

function skillMetadata(bytes: Buffer) {
  const frontmatter = bytes.toString("utf8").match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) throw new Error("Missing skill frontmatter");
  const field = (name: string) => {
    const match = frontmatter[1].match(new RegExp(`^${name}: ([^\\n]+)$`, "m"));
    if (!match) throw new Error(`Missing ${name}`);
    return match[1];
  };
  return { name: field("name"), description: field("description") };
}

describe("official public reading package", () => {
  it("keeps portable and Codex identities aligned with the marketplace source", () => {
    const portable = readJson(path.join(packageRoot, "plugin.json"));
    const codex = readJson(path.join(packageRoot, ".codex-plugin/plugin.json"));
    const marketplace = readJson(path.join(repositoryRoot, ".agents/plugins/marketplace.json"));
    const identity = {
      name: "proper-respect",
      version: "0.1.0",
      author: { name: "lecturesfrom", email: "33@lecturesfrom.com" },
    };
    expect(portable).toMatchObject(identity);
    expect(codex).toMatchObject(identity);
    for (const key of ["description", "homepage", "repository", "keywords"]) {
      expect(codex[key]).toEqual(portable[key]);
    }
    expect(portable.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(Object.keys(portable).every((key) => ["$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"].includes(key))).toBe(true);
    expect(codex.skills).toBe("./skills/");
    expect(codex.interface.developerName).toBe(portable.author.name);
    expect(marketplace.name).toBe("proper-respect-official");
    expect(marketplace.plugins).toHaveLength(1);
    const entry = marketplace.plugins[0];
    expect(entry.name).toBe(portable.name);
    expect(entry.source.source).toBe("local");
    expect(realpathSync(path.resolve(repositoryRoot, entry.source.path))).toBe(realpathSync(packageRoot));
    expect(entry.policy).toEqual({ installation: "AVAILABLE", authentication: "ON_INSTALL" });
    expect(entry.category).toBe("Productivity");
  });

  it("indexes the exact self-contained skill artifact on any site origin", () => {
    const index = readJson(path.join(repositoryRoot, "public/.well-known/agent-skills/index.json"));
    expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
    expect(index.skills).toHaveLength(1);
    const entry = index.skills[0];
    expect(entry.type).toBe("skill-md");
    const artifact = path.join(repositoryRoot, "public", entry.url);
    expect(realpathSync(artifact).startsWith(realpathSync(packageRoot) + path.sep)).toBe(true);
    const bytes = readFileSync(artifact);
    expect(entry).toMatchObject(skillMetadata(bytes));
    expect(path.basename(path.dirname(artifact))).toBe(entry.name);
    expect(entry.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(entry.digest).toBe(`sha256:${createHash("sha256").update(bytes).digest("hex")}`);
    for (const origin of ["https://proper-respect.com", "https://public.example"]) {
      const resolved = new URL(entry.url, `${origin}/.well-known/agent-skills/index.json`);
      expect(resolved.origin).toBe(origin);
      expect(resolved.pathname).toBe("/agent-plugins/proper-respect/skills/read-public-profile/SKILL.md");
    }
  });

  it("loads from an isolated copy with no escaping paths or executable components", () => {
    const temporary = mkdtempSync(path.join(tmpdir(), "proper-respect-package-"));
    try {
      const copy = path.join(temporary, "proper-respect");
      cpSync(packageRoot, copy, { recursive: true });
      const root = realpathSync(copy);
      function inspect(directory: string) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          expect(entry.isSymbolicLink()).toBe(false);
          expect(realpathSync(file).startsWith(root + path.sep)).toBe(true);
          if (entry.isDirectory()) inspect(file);
        }
      }
      inspect(copy);
      expect(readdirSync(copy).sort()).toEqual([".codex-plugin", "README.md", "plugin.json", "skills"]);
      const codex = readJson(path.join(copy, ".codex-plugin/plugin.json"));
      const skills = path.resolve(copy, codex.skills);
      expect(readdirSync(skills)).toEqual(["read-public-profile"]);
      expect(readdirSync(path.join(skills, "read-public-profile"))).toEqual(["SKILL.md"]);
      expect(skillMetadata(readFileSync(path.join(skills, "read-public-profile/SKILL.md"))).name).toBe("read-public-profile");
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});
