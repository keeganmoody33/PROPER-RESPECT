import { agentInstructions } from "@/src/server/agent-instructions";
import { markdownResponse } from "@/src/server/agent-discovery";

export function GET() {
  return markdownResponse(agentInstructions());
}
