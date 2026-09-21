import { agentCatalog } from "@/src/server/agent-discovery";

export function GET() {
  return Response.json(agentCatalog(), { headers: { "Access-Control-Allow-Origin": "*" } });
}
