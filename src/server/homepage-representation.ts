import { NextResponse, type NextRequest } from "next/server";

type MediaRange = { media: string; quality: number; specificity: number; parameterCount: number };

function splitHeader(value: string, separator: string): string[] | undefined {
  const parts: string[] = [];
  let quoted = false;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (escaped) { escaped = false; continue; }
    if (quoted && char === "\\") { escaped = true; continue; }
    if (char === '"') quoted = !quoted;
    if (!quoted && char === separator) { parts.push(value.slice(start, index)); start = index + 1; }
  }
  return quoted || escaped ? undefined : [...parts, value.slice(start)];
}

export function prefersHomepageMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const entries = splitHeader(accept, ",");
  if (!entries) return false;
  const ranges: MediaRange[] = [];
  for (const entry of entries) {
    if (!entry.trim()) continue;
    const parts = splitHeader(entry, ";");
    if (!parts) return false;
    const media = parts[0].trim().toLowerCase();
    let quality = 1;
    let hasQuality = false;
    let matchesParameters = true;
    let parameterCount = 0;
    for (const parameter of parts.slice(1)) {
      const match = parameter.trim().match(/^([^=\s]+)\s*=\s*(.+)$/);
      if (!match) return false;
      const [, rawName, rawValue] = match;
      const name = rawName.toLowerCase();
      if (name === "q") {
        if (hasQuality || !/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(rawValue)) return false;
        hasQuality = true;
        quality = Number(rawValue);
      } else {
        parameterCount++;
        if (name !== "charset" || !/^(?:utf-8|"utf-8")$/i.test(rawValue)) matchesParameters = false;
      }
    }
    if (!matchesParameters) continue;
    if (["text/html", "text/markdown", "text/*", "*/*"].includes(media)) {
      ranges.push({ media, quality, specificity: media === "*/*" ? 0 : media === "text/*" ? 1 : 2, parameterCount });
    }
  }
  if (!ranges.some(range => range.media === "text/markdown")) return false;
  const qualityFor = (media: string) => {
    const matches = ranges.filter(range => range.media === media || range.media === "text/*" || range.media === "*/*");
    matches.sort((a, b) => b.specificity - a.specificity || b.parameterCount - a.parameterCount || b.quality - a.quality);
    return matches[0]?.quality ?? 0;
  };
  const markdown = qualityFor("text/markdown");
  return markdown > 0 && markdown > qualityFor("text/html");
}

export function homepageRepresentation(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname !== "/" || !["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const markdown = prefersHomepageMarkdown(request.headers.get("accept"));
  const response = markdown
    ? NextResponse.rewrite(new URL("/index.md", request.url))
    : NextResponse.next();
  response.headers.set("Vary", "Accept");
  // Next replaces Vary when rendering HTML. Never let that variant enter a shared cache.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
