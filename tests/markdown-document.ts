import { createRequire } from "node:module";
import { resolve } from "node:path";

const { load } = createRequire(resolve("package.json"))("js-yaml") as { load(input: string): unknown };

export function parseMarkdownDocument(text: string) {
  const match = /^---\n([\s\S]*?)\n---\n\n/.exec(text);
  if (!match) throw new Error("Markdown frontmatter unavailable.");
  const metadata = load(match[1]);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Markdown metadata must be a mapping.");
  return { metadata: metadata as Record<string, unknown>, body: text.slice(match[0].length) };
}
