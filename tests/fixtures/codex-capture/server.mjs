import { createInterface } from "node:readline";
import assert from "node:assert/strict";
const mode = process.argv[2];
const sentinel = "PRIVATE_SENTINEL_é🔒";
const init = { id: 1, result: { codexHome: `/synthetic/${sentinel}`, platformFamily: "unix", platformOs: "fixture", userAgent: sentinel } };
const reply = { id: 2, result: { summary: { lifetimeTokens: 0 }, dailyUsageBuckets: null, threadUsage: null } };
let received = 0;
const send = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const lines = createInterface({ input: process.stdin });
if (mode === "ignore-term") process.on("SIGTERM", () => {});
lines.on("line", line => {
  const request = JSON.parse(line);
  received++;
  if (received === 1) {
    assert.equal(request.id, 1);
    assert.equal(request.method, "initialize");
    assert.equal(request.params.capabilities.optOutNotificationMethods.length, 81);
    assert.equal(request.params.capabilities.experimentalApi, false);
    if (mode === "eof") { process.exit(0); }
    if (mode === "hang" || mode === "ignore-term") { process.stderr.write("READY"); setInterval(() => {}, 1000); return; }
    if (mode === "rounded-init-id") process.stdout.write(JSON.stringify(init).replace('"id":1', '"id":1.0000000000000001') + "\n");
    else if (mode === "split") {
      const bytes = Buffer.from(JSON.stringify(init) + "\n");
      let index = 0;
      const timer = setInterval(() => {
        process.stdout.write(bytes.subarray(index, ++index));
        if (index === bytes.length) clearInterval(timer);
      }, 1);
    } else send(init);
    return;
  }
  if (received === 2) { assert.deepEqual(request, { method: "initialized", params: {} }); return; }
  assert.equal(received, 3);
  assert.deepEqual(request, { id: 2, method: "account/usage/read", params: {} });
  send({ method: "configWarning", params: { private: sentinel } });
  process.stderr.write(sentinel);
  let raw = JSON.stringify(reply);
  switch (mode) {
    case "rounded-usage-id": raw = raw.replace('"id":2', '"id":2.0000000000000001'); break;
    case "missing": reply.result.summary = {}; raw = JSON.stringify(reply); break;
    case "duplicate-date": reply.result.dailyUsageBuckets = [{startDate: "2026-09-23", tokens: 0}, {startDate: "2026-09-23", tokens: 1}]; raw = JSON.stringify(reply); break;
    case "stdout-total": for (let i = 0; i < 3; i++) send({method: "configWarning", params: "x".repeat(200000)}); break;
    case "truncated-utf8": process.stdout.write(Buffer.from([0xc3])); break;
    case "nulls": reply.result.summary = { lifetimeTokens: null }; raw = JSON.stringify(reply); break;
    case "capture-limit": raw = raw.slice(0, -2) + " ".repeat(255900 - raw.length) + "}}"; break;
    case "day-limit":
    case "days": reply.result.dailyUsageBuckets = Array.from({length: mode === "day-limit" ? 3660 : 3661}, (_, i) => ({startDate: new Date(Date.UTC(2000, 0, i + 1)).toISOString().slice(0, 10), tokens: 0})); raw = JSON.stringify(reply); break;
    case "unknown": send({ method: "unknown", params: sentinel }); break;
    case "request": send({ id: 3, method: "account/read", params: {} }); break;
    case "thread": reply.result.threadUsage = { threadId: sentinel }; raw = JSON.stringify(reply); break;
    case "extra": reply.result.summary.private = sentinel; raw = JSON.stringify(reply); break;
    case "wrong-id": reply.id = 99; raw = JSON.stringify(reply); break;
    case "fraction": raw = raw.replace('"lifetimeTokens":0', '"lifetimeTokens":1.0000000000000001'); break;
    case "underflow": raw = raw.replace('"lifetimeTokens":0', '"lifetimeTokens":1e-999'); break;
    case "unsafe": raw = raw.replace('"lifetimeTokens":0', '"lifetimeTokens":9007199254740993'); break;
    case "escaped-duplicate": raw = raw.replace('"lifetimeTokens":0', '"lifetimeTokens":0,"\\u006cifetimeTokens":1'); break;
    case "deep": raw = '{"method":"configWarning","params":' + '['.repeat(34) + '0' + ']'.repeat(34) + '}'; break;
    case "flood": for (let i = 0; i < 130; i++) send({ method: "configWarning", params: sentinel }); break;
    case "stderr": process.stderr.write("x".repeat(65000)); break;
    case "oversize": process.stdout.write("x".repeat(261000)); break;
    case "utf8": process.stdout.write(Buffer.from([0xc3, 0x28, 10])); break;
    case "malformed": process.stdout.write("{\n"); break;
  }
  if (mode === "split") {
    const bytes = Buffer.from(raw + "\n");
    for (const byte of bytes) process.stdout.write(Buffer.from([byte]));
  } else process.stdout.write(raw + "\n");
  if (mode === "duplicate") process.stdout.write(raw + "\n");
  if (mode === "late-duplicate") setTimeout(() => process.stdout.write(raw + "\n"), 20);
  if (mode === "tail") process.stdout.write("PRIVATE_SENTINEL");
  if (mode === "drain-hang") setInterval(() => {}, 1000);
});
lines.on("close", () => {
  if (mode === "nonzero") process.exitCode = 7;
  if (mode === "signal") process.kill(process.pid, "SIGTERM");
});
