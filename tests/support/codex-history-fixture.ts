import type { ConnectionDescriptor, HistoryWindow } from "../../src/domain/connection-history.ts";
import { collectCodexHistoryFixture, type CodexFixtureFile } from "../../src/local/codex-history-collector.ts";
import type { HistoryCollector } from "../../src/local/usage-connection.ts";

export const codexFixtureDescriptor: ConnectionDescriptor = {
  provider: "codex", sourceKind: "local-history", authMode: "none", ownerAlias: "demo-owner", sourceAlias: "demo-local-history",
  deviceAlias: "demo-device", accountAlias: null, sample: "synthetic", collectorVersion: "codex-fixture-v1",
};
export const codexFixtureWindow: HistoryWindow = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };
export function fixtureTokenLine(at: string, input: number, output: number) {
  return JSON.stringify({ timestamp: at, type: "event_msg", payload: { type: "token_count", info: { total_token_usage: {
    input_tokens: input, cached_input_tokens: 0, output_tokens: output, reasoning_output_tokens: 0, total_tokens: input + output,
  } } } });
}
export function codexFixtureFiles(advanced = false): CodexFixtureFile[] {
  return [
    { sessionAlias: "session-one", lines: [
      JSON.stringify({ type: "response_item", payload: { content: "PRIVATE_PROMPT_SENTINEL", cwd: "/private/path-sentinel", credential: "PRIVATE_CREDENTIAL_SENTINEL" } }),
      fixtureTokenLine("2026-10-02T09:00:00.000Z", 80, 20),
      fixtureTokenLine("2026-10-02T10:00:00.000Z", 160, 40),
      ...(advanced ? [fixtureTokenLine("2026-10-02T11:00:00.000Z", 200, 50)] : []),
    ] },
    { sessionAlias: "session-two", lines: [
      fixtureTokenLine("2026-10-03T09:00:00.000Z", 0, 0),
      fixtureTokenLine("2026-10-03T10:00:00.000Z", 40, 10),
    ] },
  ];
}
export function createCodexHistoryFixture() {
  let advanced = false, fail = false;
  const collect: HistoryCollector = async request => {
    await new Promise<void>((resolve, reject) => {
      if (request.signal.aborted) { reject(new Error("disconnected")); return; }
      const abort = () => { clearTimeout(timer); reject(new Error("disconnected")); };
      const timer = setTimeout(() => { request.signal.removeEventListener("abort", abort); resolve(); }, 80);
      request.signal.addEventListener("abort", abort, { once: true });
    });
    if (fail) { fail = false; throw new Error("synthetic-read-failure"); }
    return collectCodexHistoryFixture(request, codexFixtureFiles(advanced));
  };
  return { descriptor: { ...codexFixtureDescriptor }, window: { ...codexFixtureWindow }, collect,
    advance: () => { advanced = true; }, failNext: () => { fail = true; } };
}
