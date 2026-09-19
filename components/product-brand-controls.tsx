"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** Explicit retry/refresh for existing cards; renders never initiate provider IO. */
export function ProductBrandControls({ propId }: { propId: Id<"props"> }) {
  const state = useQuery(api.productBrands.getForProp, { propId });
  const request = useMutation(api.productBrands.requestForProp);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const running = state?.status === "PENDING" || state?.status === "RUNNING";
  if (!state) return null;
  if (state.status === "PRODUCT_IDENTITY_REQUIRED") return <p className="product-brand-controls">This product needs a verified product-specific brand. Its parent company’s logo will not be used in its place.</p>;
  if (state.status === "UNVERIFIED_DOMAIN") return <p className="product-brand-controls">This product’s website has not yet been verified for brand retrieval. Your saved product and history are unaffected.</p>;

  return <div className="product-brand-controls">
    <p>{state.current ? "Retained brand identity is available for this card." : "Brand identity has not been loaded."}</p>
    {running && <p role="status">Brand retrieval is pending. You can retry if it stops responding.</p>}
    <button type="button" className="secondary-action" disabled={pending} onClick={async () => {
      setPending(true); setError(false);
      try { await request({ propId, refresh: Boolean(state.current) }); }
      catch { setError(true); }
      finally { setPending(false); }
    }}>{pending ? "Requesting brand identity…" : running ? "Retry brand identity" : state.current ? "Refresh brand identity" : "Load brand identity"}</button>
    {state.status === "FAILED" && <p role="status">Brand retrieval is unavailable. Existing card styling remains available.</p>}
    {error && <p role="alert">Could not request brand identity. Try again later.</p>}
  </div>;
}
