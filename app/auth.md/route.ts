import { authenticationMarkdown } from "@/src/server/agent-discovery";

export function GET() {
  return new Response(authenticationMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
