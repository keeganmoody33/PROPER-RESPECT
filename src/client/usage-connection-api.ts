import { makeFunctionReference, type FunctionArgs, type FunctionReturnType, type ApiFromModules } from "convex/server";
import type * as connections from "../../convex/usageConnections";
export type ConnectionsAPI = ApiFromModules<{ connections: typeof connections }>["connections"];
export const approveUsage = makeFunctionReference<"mutation", FunctionArgs<ConnectionsAPI["approve"]>, FunctionReturnType<ConnectionsAPI["approve"]>>("usageConnections:approve");
export const listUsage = makeFunctionReference<"query", FunctionArgs<ConnectionsAPI["list"]>, FunctionReturnType<ConnectionsAPI["list"]>>("usageConnections:list");
export const usageEvidence = makeFunctionReference<"query", FunctionArgs<ConnectionsAPI["evidence"]>, FunctionReturnType<ConnectionsAPI["evidence"]>>("usageConnections:evidence");
export const disconnectUsage = makeFunctionReference<"mutation", FunctionArgs<ConnectionsAPI["disconnect"]>, FunctionReturnType<ConnectionsAPI["disconnect"]>>("usageConnections:disconnect");
export const eraseUsage = makeFunctionReference<"mutation", FunctionArgs<ConnectionsAPI["erase"]>, FunctionReturnType<ConnectionsAPI["erase"]>>("usageConnections:erase");
