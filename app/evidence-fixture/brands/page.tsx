import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function BrandPreviewPage() {
  const directory = process.env.PROPER_RESPECT_BRAND_RECEIPTS_DIR;
  if (process.env.NODE_ENV !== "development" || !directory) notFound();
  // Load the local-file reader only after the development-only route gate.
  const { readRetainedBrandReceipt } = await import("@/src/server/retained-brand-receipt");
  const receipts = await Promise.all(["wisprflow", "github"].map(slug => readRetainedBrandReceipt(directory, slug).catch(() => null)));

  return <main className="stack">
    <p className="eyebrow">DEVELOPMENT · BRAND PRESENTATION ONLY</p>
    <h1>Retained product brands</h1>
    <p>Real Context.dev brand snapshots, rendered locally. No owner relationship, personal activity, or usage verification is included.</p>
    <section className="card-grid" aria-label="Brand previews">
      {receipts.map((receipt, index) => receipt ? <ProductCard key={receipt.product.slug} index={index} displayMode="brand-preview" card={{
        product: { ...receipt.product, brand: receipt.snapshot },
        status: "TESTING", headline: "", note: "",
        primaryLink: { type: "CANONICAL", url: `https://${receipt.product.domain}`, label: `Visit ${receipt.product.name}` },
      }} /> : <p key={index}>A retained brand receipt is unavailable or invalid.</p>)}
    </section>
    <p>This development preview reads local receipts. Hosted backend synchronization is a separate operation.</p>
  </main>;
}
