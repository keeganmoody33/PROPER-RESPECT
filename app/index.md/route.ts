import { homepageMarkdown, markdownResponse } from "@/src/server/agent-discovery";
import { publicSiteOrigin } from "@/src/server/public-site";

export function GET() {
  const response = markdownResponse(homepageMarkdown());
  const origin = publicSiteOrigin();
  response.headers.set("Vary", "Accept");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Content-Location", new URL("/index.md", origin).href);
  response.headers.set("Link", `<${origin.href}>; rel="canonical", <${origin.href}>; rel="alternate"; type="text/html"`);
  if (process.env.VERCEL_ENV === "preview") response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
