import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import { UsageConnectionsPanel } from "../../components/usage-connections-panel";
import { grantScopeSchema, numericEvidenceSchema } from "../../src/domain/usage-sync";
import type { Id } from "../../convex/_generated/dataModel";
import "./style.css";
const id = <T extends "usageGrants" | "usageSources">() => z.custom<Id<T>>(value => typeof value === "string" && value.length > 0 && value.length <= 128);
const grantsSchema = z.array(z.object({ ownerSubject: z.string(), grantId: id<"usageGrants">(), sourceId: id<"usageSources">(), scope: grantScopeSchema,
  state: z.enum(["pending", "active", "revoked", "expired"]), sequence: z.number(), lastSyncedAt: z.string().nullable(), pairExpiresAt: z.number() }));
async function rpc(operation: string, args: unknown = {}): Promise<unknown> {
  const response = await fetch(`/fixture/${operation}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
  if (!response.ok) throw new Error("Fixture operation failed.");
  return response.json();
}
function Demo() {
  const [grants, setGrants] = useState<z.infer<typeof grantsSchema>>([]), [code, setCode] = useState("");
  const [notice, setNotice] = useState(""), [identity, setIdentity] = useState<{ sourceKey: string; deviceDigest: string } | null>(null);
  const refresh = async () => setGrants(grantsSchema.parse(await rpc("list")));
  useEffect(() => { void rpc("list").then(value => setGrants(grantsSchema.parse(value))); void rpc("identity").then(value => setIdentity(z.object({ sourceKey: z.string(), deviceDigest: z.string() }).parse(value))); }, []);
  return <main><p className="fixture-banner">SYNTHETIC LOCAL DEMO. No Mac or live account is connected. Convex test runtime, real native reader, real collector and private helper state.</p>
    <details open><summary>Synthetic helper</summary><p>Source identity <code data-testid="fixture-source">{identity?.sourceKey}</code></p><p>Device digest <code data-testid="fixture-device">{identity?.deviceDigest}</code></p>
      <label>Fixture pairing code<input value={code} onChange={event => setCode(event.target.value)} /></label>
      <button onClick={async () => { try { await rpc("pair", { code }); await rpc("sync"); await refresh(); setNotice("Synthetic backfill acknowledged."); } catch { setNotice("Synthetic pairing or backfill failed."); } }}>Pair synthetic helper and backfill</button>
      <button onClick={async () => { try { await rpc("sync"); await refresh(); setNotice("Synthetic helper restarted from disk; sync acknowledged."); } catch { setNotice("Synthetic sync rejected, including after revocation."); } }}>Restart helper and sync</button>
      <button onClick={async () => { await rpc("append"); await rpc("sync"); await refresh(); setNotice("Synthetic response acknowledged."); }}>Add synthetic response</button>
      <button onClick={async () => { try { await rpc("sync", { loseAck: true }); } catch { setNotice("Synthetic ACK lost. Pending packet remains on disk."); } await refresh(); }}>Lose next acknowledgment</button>
      <p role="status">{notice}</p>
    </details>
    <UsageConnectionsPanel grants={grants} approve={async args => { const result = id<"usageGrants">().parse(await rpc("approve", args)); await refresh(); return result; }}
      disconnect={async args => { const result = z.object({ retained: z.boolean() }).parse(await rpc("disconnect", args)); await refresh(); return result; }}
      erase={async args => z.object({ done: z.boolean() }).parse(await rpc("erase", args))}
      evidence={async args => z.object({ page: z.array(numericEvidenceSchema), isDone: z.boolean(), continueCursor: z.string() }).parse(await rpc("evidence", args))} />
  </main>;
}
createRoot(document.getElementById("root") ?? document.body).render(<Demo />);
