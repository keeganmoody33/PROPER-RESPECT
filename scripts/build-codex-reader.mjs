import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
mkdirSync(new URL("../.local-bin/", import.meta.url), { recursive: true });
for (const name of ["codex-reader", "codex-stream-reader", "companion-lock"]) {
  const temporary = `.local-bin/${name}.${process.pid}.tmp`;
  const source = name === "codex-stream-reader" ? "codex-reader" : name;
  const defines = name === "codex-stream-reader" ? ["-DPR_STREAM_READER"] : [];
  const result = spawnSync("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", ...defines, `native/${source}.c`, "-o", temporary], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) { try { unlinkSync(new URL(temporary, `file://${root}`)); } catch {} process.exitCode = result.status ?? 1; break; }
  renameSync(new URL(temporary, `file://${root}`), new URL(`.local-bin/${name}`, `file://${root}`));
}
