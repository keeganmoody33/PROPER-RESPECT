"use client";

import { useEffect } from "react";
import type { PublicSiteGuide } from "@/src/server/agent-discovery";

export type PublicSiteGuideTool = Readonly<{
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, never>; additionalProperties: false };
  annotations: { readOnlyHint: true; untrustedContentHint: false };
  execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<PublicSiteGuide | { error: string }>;
}>;
export type PublicSiteGuideModelContext = {
  registerTool: (tool: PublicSiteGuideTool, options: { signal: AbortSignal }) => Promise<void>;
};

export function registerPublicSiteGuideTool(context: PublicSiteGuideModelContext, guide: PublicSiteGuide): () => void {
  const controller = new AbortController();
  const snapshot = JSON.stringify(guide);
  const tool: PublicSiteGuideTool = {
    name: "get_public_site_guide",
    description: "Explains Proper Respect, links to public documentation, and describes how to read a supplied published profile.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    async execute(input, options) {
      controller.signal.throwIfAborted();
      options?.signal?.throwIfAborted();
      if (input === null || typeof input !== "object" || Array.isArray(input) || Reflect.ownKeys(input).length !== 0) {
        return { error: "Use an empty object {}. This tool returns the public site guide and accepts no URL, handle, or other arguments." };
      }
      return JSON.parse(snapshot) as PublicSiteGuide;
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

export function PublicSiteGuideWebMcp({ guide }: { guide: PublicSiteGuide }) {
  useEffect(() => {
    const context = (document as Document & { modelContext?: PublicSiteGuideModelContext }).modelContext;
    if (typeof context?.registerTool !== "function") return;
    return registerPublicSiteGuideTool(context, guide);
  }, [guide]);
  return null;
}
