import { homepageMarkdown, markdownResponse } from "@/src/server/agent-discovery";

export function GET() {
  return markdownResponse(homepageMarkdown());
}
