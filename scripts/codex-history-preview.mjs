#!/usr/bin/env node
// Local numeric review only. No implicit source, auth, output file, or network.

const usage = "Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/codex-history-preview.mjs --directory /absolute/selected/directory --start YYYY-MM-DDTHH:MM:SS.sssZ --end YYYY-MM-DDTHH:MM:SS.sssZ\nLinux and Node.js 24 required. Maximum window: 7 days. Reads bounded rollout-*.jsonl files only. Outputs a private numeric JSON review to stdout. No upload or account access.\n";
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  process.stdout.write(usage);
} else {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const deadline = setTimeout(cancel, 5000);
  const started = performance.now();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    if (args.length !== 6 || args[0] !== "--directory" || args[2] !== "--start" || args[4] !== "--end") throw new Error();
    const { readCodexRolloutDirectory } = await import("../src/local/codex-rollout-files.ts");
    const { collectCodexRolloutHistory } = await import("../src/local/codex-history-collector.ts");
    const window = { start: args[3], end: args[5] };
    // Validate the requested window before touching the selected directory.
    collectCodexRolloutHistory({ window, signal: controller.signal }, []);
    const scanned = await readCodexRolloutDirectory({ directory: args[1], signal: controller.signal });
    const history = collectCodexRolloutHistory({ window, signal: controller.signal }, scanned.files);
    const text = JSON.stringify({ ...history, scan: { scannedFiles: scanned.scannedFiles, ignoredEntries: scanned.ignoredEntries } }, null, 2);
    // Synchronous parsing shares the read deadline; a delayed timer cannot let a
    // late result through. No output is committed before every check succeeds.
    if (controller.signal.aborted || performance.now() - started >= 5000 || Buffer.byteLength(text) > 8 * 1024 * 1024) throw new Error();
    process.stdout.write(`${text}\n`);
  } catch {
    process.stderr.write("Could not verify the selected Codex history. Check the explicit directory, UTC window and documented limits. No review was emitted; no data was uploaded or written.\n");
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
