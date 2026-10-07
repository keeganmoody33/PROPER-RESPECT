"use client";
import { UsageConnectionsPanel } from "./usage-connections-panel";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { approveUsage, listUsage, usageEvidence, disconnectUsage, eraseUsage } from "@/src/client/usage-connection-api";

export function UsageConnectionsClient() {
  const auth = useAuth();
  if (!auth.isLoaded) return <p role="status">Loading account…</p>;
  if (!auth.isSignedIn) return <p>Sign in to view and approve private connections.</p>;
  return <Connections key={auth.userId} ownerSubject={auth.userId} />;
}
function Connections({ ownerSubject }: { ownerSubject: string }) {
  const grants = useQuery(listUsage, {}), approve = useMutation(approveUsage), disconnect = useMutation(disconnectUsage), erase = useMutation(eraseUsage);
  const client = useConvex();
  return <UsageConnectionsPanel grants={grants?.filter(grant => grant.ownerSubject === ownerSubject)} approve={approve} disconnect={disconnect} erase={erase} evidence={args => client.query(usageEvidence, args)} />;
}
