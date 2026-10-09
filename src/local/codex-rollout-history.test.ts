import { describe, expect, it } from "vitest";
import { collectCodexRolloutHistory } from "./codex-history-collector.ts";

const window = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-08T00:00:00.000Z" };
const request = () => ({ window, signal: new AbortController().signal });
const line = (type: string, payload: unknown, at = "2026-10-02T00:00:00.000Z") => JSON.stringify({ timestamp: at, type, payload });
const counts = (input: number, output = 0) => ({ input_tokens: input, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: output, reasoning_output_tokens: 0, total_tokens: input + output });
const meta = (id = "thread-one", more = {}) => line("session_meta", { id, session_id: "root-one", cwd: "/PRIVATE_PATH", base_instructions: "PRIVATE_INSTRUCTIONS", creator_account_id: "PRIVATE_ACCOUNT", ...more });
const response = (id: string, usage = counts(10), thread = "thread-one", at?: string) => line("token_usage_record", { thread_id: thread, session_id: "root-one", turn_id: "turn", root_turn_id: "root-turn", response_id: id, usage, turn_token_usage: counts(99999), thread_token_usage: counts(99999) }, at);
const snapshot = (total: number, last: number, at = "2026-10-02T00:00:00.000Z") => line("event_msg", { type: "token_count", info: { total_token_usage: counts(total), last_token_usage: counts(last), model_context_window: 200000 }, rate_limits: { used_percent: 50 } }, at);
const collect = (lines: string[], extraFiles: string[][] = []) => collectCodexRolloutHistory(request(), [lines, ...extraFiles].map(lines => ({ lines })));
const total = (review: ReturnType<typeof collect>, kind: "responses" | "legacy", metric = "total_tokens") => review[kind].totals.find(row => row.metric === metric)?.value;

describe("official-format numeric Codex rollout collection", () => {
  it("counts response usage once, never cumulative UI/turn/thread totals or content", () => {
    const review = collect([meta(), response("response-one", counts(30, 10)), snapshot(99999, 50000),
      line("response_item", { content: "PRIVATE_CONTENT".repeat(1000) }), line("turn_context", { cwd: "/PRIVATE_PATH" })]);
    expect(total(review, "responses")).toBe("40");
    expect(total(review, "legacy")).toBeNull();
    expect(review.diagnostics.legacyThreadsSuperseded).toBe(1);
    expect(JSON.stringify(review)).not.toMatch(/PRIVATE_|root-one|thread-one|response-one|response_item|rate_limits/);
    expect(review.source.accountAlias).toBeNull();
    expect(review.coverage).toBe("partial");
  });
  it("deduplicates active/archive copies and preserves independent same-millisecond responses", () => {
    const original = [meta(), response("response-one"), response("response-two")];
    const review = collect(original, [original]);
    expect(total(review, "responses")).toBe("20");
    expect(review.responses.rows).toHaveLength(2);
    expect(review.responses.replays).toBe(2);
    expect(collect(original).responses.rows).toEqual(review.responses.rows);
  });
  it("quarantines response-identity conflicts instead of adding or choosing a maximum", () => {
    const review = collect([meta(), response("response-one")], [[meta(), response("response-one", counts(20))]]);
    expect(total(review, "responses")).toBeNull();
    expect(review.responses.rows.every(row => row.status === "conflict")).toBe(true);
  });
  it("cannot hide an in-window conflict behind a different out-of-window timestamp", () => {
    const review = collect([meta(), response("response-one")], [[meta(), response("response-one", counts(10), "thread-one", window.end)]]);
    expect(review.responses.rows).toHaveLength(1);
    expect(review.responses.rows[0].status).toBe("conflict");
  });
  it("excludes inherited fork responses even when parent history is absent", () => {
    const review = collect([meta("child", { forked_from_id: "parent" }), meta("parent"), response("inherited", counts(100), "parent"),
      response("own", counts(7), "child"), snapshot(100, 100), snapshot(107, 7, "2026-10-02T00:00:01.000Z")]);
    expect(total(review, "responses")).toBe("7");
    expect(review.diagnostics.inheritedResponsesExcluded).toBe(1);
    expect(total(review, "legacy")).toBeNull();
  });
  it("ignores compaction checkpoints but counts actual compaction responses", () => {
    const review = collect([meta(), response("one"), line("compacted", { latest_token_usage_record: { response_id: "one", usage: counts(10) }, message: "PRIVATE_SUMMARY" }), response("compact", counts(5))]);
    expect(total(review, "responses")).toBe("15");
    expect(review.diagnostics.compactionCheckpointsIgnored).toBe(1);
  });
  it("keeps first snapshots as baselines and uses a pre-window baseline without exposing it", () => {
    const review = collect([meta(), snapshot(50, 50, "2026-09-30T23:59:59.000Z"), snapshot(70, 20), snapshot(75, 5, window.end)]);
    expect(total(review, "legacy")).toBe("20");
    expect(review.legacy.rows.every(row => row.at >= window.start && row.at < window.end)).toBe(true);
    expect(total(collect([meta(), snapshot(70, 70)]), "legacy")).toBeNull();
  });
  it("replays legacy file copies without duplicate increases", () => {
    const original = [meta(), snapshot(50, 50), snapshot(70, 20, "2026-10-02T00:00:01.000Z")];
    const review = collect(original, [original]);
    expect(total(review, "legacy")).toBe("20");
    expect(review.legacy.replays).toBe(12);
  });
  it("never fills modern-record gaps with legacy totals from the same thread", () => {
    const review = collect([meta(), snapshot(0, 0), snapshot(100, 100, "2026-10-02T00:00:01.000Z"), response("one", counts(1))]);
    expect(total(review, "responses")).toBe("1");
    expect(total(review, "legacy")).toBeNull();
  });
  it("keeps modern threads and legacy threads in separate totals", () => {
    const review = collect([meta(), response("one")], [[meta("legacy"), snapshot(0, 0), snapshot(20, 20, "2026-10-02T00:00:01.000Z")]]);
    expect(total(review, "responses")).toBe("10"); expect(total(review, "legacy")).toBe("20");
  });
  it("excludes legacy forks, subagents, and referenced histories rather than guessing their inherited boundary", () => {
    for (const more of [{ forked_from_id: "parent" }, { parent_thread_id: "parent" }, { history_base: { thread_id: "other", end_ordinal_exclusive: 30 } }, { subagent_history_start_ordinal: 30 }]) {
      const review = collect([meta("child", more), snapshot(0, 0), snapshot(100, 100, "2026-10-02T00:00:01.000Z")]);
      expect(total(review, "legacy")).toBeNull(); expect(review.diagnostics.legacyThreadsExcluded).toBe(1);
    }
  });
  it("does not count synthetic full-context updates, resets, or their recovery", () => {
    const review = collect([meta(), snapshot(100, 100), snapshot(1, 1, "2026-10-02T00:00:01.000Z"),
      snapshot(200000, 10, "2026-10-02T00:00:02.000Z"), snapshot(200010, 10, "2026-10-02T00:00:03.000Z")]);
    expect(total(review, "legacy")).toBe("10"); expect(review.diagnostics.legacyIntervalsExcluded).toBe(2);
  });
  it("does not count the first cumulative sample after a compaction as fresh usage", () => {
    const review = collect([meta(), snapshot(100, 100), line("compacted", {}, "2026-10-02T00:00:01.000Z"),
      snapshot(110, 10, "2026-10-02T00:00:02.000Z"), snapshot(120, 10, "2026-10-02T00:00:03.000Z")]);
    expect(total(review, "legacy")).toBe("10");
  });
  it("keeps unknown counters unknown, exact zeros measured, and subsets separate", () => {
    const text = response("one", counts(0)).replace('"cache_write_input_tokens":0,', "");
    const review = collect([meta(), text]);
    expect(total(review, "responses")).toBe("0");
    expect(total(review, "responses", "cache_write_input_tokens")).toBeNull();
  });
  it("preserves counters beyond JavaScript's exact numeric range", () => {
    const text = response("one", counts(0)).replace('"total_tokens":0', '"total_tokens":90071992547409931234567890');
    expect(total(collect([meta(), text]), "responses")).toBe("90071992547409931234567890");
  });
  it.each(["-1", "0.5", "1e3", '"5"'])("rejects unsupported counter %s", token => {
    const text = response("one", counts(0)).replace('"total_tokens":0', `"total_tokens":${token}`);
    expect(() => collect([meta(), text])).toThrow();
  });
  it("rejects duplicate metadata keys, invalid subsets, timestamp precision, and missing headers", () => {
    for (const lines of [[meta().replace('"id":"thread-one"', '"id":"first","id":"second"')], [meta(), response("one", { ...counts(1), cached_input_tokens: 2 })],
      [meta(), response("one", counts(1), "thread-one", "2026-10-02T00:00:00.0001Z")], [response("one")]]) expect(() => collect(lines)).toThrow();
  });
  it("rejects a cancelled read and oversized file batches", () => {
    const controller = new AbortController(); controller.abort();
    expect(() => collectCodexRolloutHistory({ window, signal: controller.signal }, [{ lines: [meta()] }])).toThrow("disconnected");
    expect(() => collectCodexRolloutHistory(request(), Array.from({ length: 65 }, () => ({ lines: [meta()] })))).toThrow();
  });
});

it("quarantines incompatible legacy copies at the same source instant", () => {
  const review = collect([meta(), snapshot(10, 10), snapshot(20, 10, "2026-10-02T00:00:01.000Z")],
    [[meta(), snapshot(10, 10), snapshot(30, 30, "2026-10-02T00:00:01.000Z")]]);
  expect(total(review, "legacy")).toBeNull();
  expect(review.legacy.rows.some(row => row.status === "conflict")).toBe(true);
});

it("excludes the official synthetic total-only full-context update even after zero", () => {
  const synthetic = line("event_msg", { type: "token_count", info: { total_token_usage: { ...counts(0), total_tokens: 200000 }, last_token_usage: { ...counts(0), total_tokens: 200000 } } }, "2026-10-02T00:00:01.000Z");
  const review = collect([meta(), snapshot(0, 0), synthetic]);
  expect(total(review, "legacy")).toBeNull();
  expect(review.diagnostics.legacyIntervalsExcluded).toBe(1);
});
it("quarantines every metric of conflicting legacy vectors, including later unverifiable increases", () => {
  const token = (n: number, out: number, last: number, at: string) => line("event_msg", { type: "token_count", info: { total_token_usage: counts(n, out), last_token_usage: counts(last) } }, at);
  const review = collect([meta(), snapshot(0, 0), token(10, 0, 10, "2026-10-02T00:00:01.000Z"), token(5, 5, 10, "2026-10-02T00:00:01.000Z"), token(500, 500, 1, "2026-10-02T00:00:02.000Z")]);
  expect(total(review, "legacy")).toBeNull();
  expect(review.legacy.rows.every(row => row.status === "conflict" && row.delta === null)).toBe(true);
});
it("is independent of file order when duplicated totals have incompatible last-usage vectors", () => {
  const first = [meta(), snapshot(10, 10), snapshot(20, 10, "2026-10-02T00:00:01.000Z")];
  const second = [meta(), snapshot(10, 10), snapshot(20, 20, "2026-10-02T00:00:01.000Z")];
  const a = collect(first, [second]), b = collect(second, [first]);
  expect(total(a, "legacy")).toBeNull(); expect(a).toEqual(b);
});
