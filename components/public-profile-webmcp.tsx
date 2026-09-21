"use client";

import { useEffect } from "react";
import type { VisiblePublicProfile } from "@/src/domain/visible-public-profile";

export type PublicProfileTool = Readonly<{
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, never>; additionalProperties: false };
  annotations: { readOnlyHint: true; untrustedContentHint: true };
  execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<VisiblePublicProfile | { error: string }>;
}>;
export type PublicProfileModelContext = {
  registerTool: (tool: PublicProfileTool, options: { signal: AbortSignal }) => Promise<void>;
};

export function registerPublicProfileTool(context: PublicProfileModelContext, profile: VisiblePublicProfile): () => void {
  const controller = new AbortController();
  const snapshot = JSON.stringify(profile);
  const tool: PublicProfileTool = {
    name: "get_current_public_profile",
    description: "Returns only the published profile and its evidence caveats—the same information visitors can see.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute(input, options) {
      controller.signal.throwIfAborted();
      options?.signal?.throwIfAborted();
      if (input === null || typeof input !== "object" || Array.isArray(input) || Reflect.ownKeys(input).length !== 0) {
        return { error: "Use an empty object {}. This tool reads only the profile on the current page and accepts no handle or other arguments." };
      }
      return JSON.parse(snapshot) as VisiblePublicProfile;
    },
  };
  void (async () => {
    try {
      await context.registerTool(tool, { signal: controller.signal });
    } catch {
      controller.abort();
    }
  })();
  return () => controller.abort();
}

export function PublicProfileWebMcp({ profile }: { profile: VisiblePublicProfile }) {
  useEffect(() => {
    const context = (document as Document & { modelContext?: PublicProfileModelContext }).modelContext;
    if (typeof context?.registerTool !== "function") return;
    return registerPublicProfileTool(context, profile);
  }, [profile]);
  return null;
}
