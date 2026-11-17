import { TrustArticle } from "@/components/trust-article";
import { originsPullQuote, trustDocuments, trustMetadata } from "@/src/server/trust-pages";

export function generateMetadata() {
  return trustMetadata("origins");
}

export default function OriginsPage() {
  return <TrustArticle document={trustDocuments.origins} pullQuote={originsPullQuote} />;
}
