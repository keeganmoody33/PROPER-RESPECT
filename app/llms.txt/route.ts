import { agentInstructions } from "@/src/server/agent-instructions";

export function GET() {
  return new Response(agentInstructions(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
