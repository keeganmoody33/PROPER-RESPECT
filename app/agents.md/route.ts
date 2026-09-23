import { agentInstructionsResponse } from "@/src/server/agent-instructions";

export function GET() {
  return agentInstructionsResponse();
}
