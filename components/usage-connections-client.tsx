"use client";
import { UsageConnectionsPanel } from "./usage-connections-panel";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import { createPrivateUsageLoader } from "@/src/client/private-usage-loader";
import { approveUsage, listUsage, usageEvidence, disconnectUsage, eraseUsage } from "@/src/client/usage-connection-api";

export function UsageConnectionsClient() {
  const auth = useAuth();
  const convexAuth = useConvexAuth();
  if (!auth.isLoaded) return <p role="status">Loading account…</p>;
  if (!auth.isSignedIn) return <p>Sign in to view and approve private connections.</p>;
  if (convexAuth.isLoading || !convexAuth.isAuthenticated) return <p role="status">Connecting private account…</p>;
  return <Connections key={auth.userId} ownerSubject={auth.userId} />;
}
function Connections({ ownerSubject }: { ownerSubject: string }) {
  const grants = useQuery(listUsage, {}), approve = useMutation(approveUsage), disconnect = useMutation(disconnectUsage), erase = useMutation(eraseUsage);
  const client = useConvex();
  const loadUsage = useMemo(() => createPrivateUsageLoader({ ownerSubject,
    list: () => client.query(listUsage, {}), evidence: args => client.query(usageEvidence, args),
  }), [client, ownerSubject]);
  return <UsageConnectionsPanel grants={grants?.filter(grant => grant.ownerSubject === ownerSubject)} approve={approve} disconnect={disconnect} erase={erase} loadUsage={loadUsage} />;
}
