import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Local agent worktrees are whole checkouts with their own build output.
  globalIgnores([".next/**", "convex/_generated/**", "prototypes/public-mcp/**", ".claude/worktrees/**"]),
]);
