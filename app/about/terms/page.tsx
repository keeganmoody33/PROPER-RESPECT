import { TrustArticle } from "@/components/trust-article";
import { trustDocuments, trustMetadata } from "@/src/server/trust-pages";

export function generateMetadata() {
  return trustMetadata("terms");
}

export default function TermsPage() {
  return <TrustArticle document={trustDocuments.terms} />;
}
