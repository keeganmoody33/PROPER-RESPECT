import { trustMarkdownResponse } from "@/src/server/trust-pages";

export function GET() {
  return trustMarkdownResponse("privacy");
}
