"use client";

import { useState } from "react";

export function CopyProfileLink({ url }: { url: string }) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "manual">("idle");
  async function copy() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }
  return <div>
    <button type="button" className="secondary-action" onClick={() => void copy()} disabled={status === "copying"}>Copy profile link</button>
    <p role="status">{status === "copied" ? "Profile link copied." : status === "manual" ? "Clipboard access is unavailable. Select and copy your link below." : ""}</p>
    {status === "manual" && <label>Profile link<input value={url} readOnly onFocus={event => event.currentTarget.select()} /></label>}
  </div>;
}
