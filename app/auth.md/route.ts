import { authenticationMarkdown, markdownResponse } from "@/src/server/agent-discovery";
import { publicSiteOrigin } from "@/src/server/public-site";

export function GET() {
  return markdownResponse(authenticationMarkdown(), {
    title: "Proper Respect authentication",
    canonical: new URL("/auth.md", publicSiteOrigin()),
  });
}
