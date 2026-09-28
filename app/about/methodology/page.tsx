import { TrustArticle } from "@/components/trust-article";
import { trustDocuments, trustMetadata } from "@/src/server/trust-pages";

export function generateMetadata() {
  return trustMetadata("methodology");
}

export default function MethodologyPage() {
  return <TrustArticle document={trustDocuments.methodology} />;
}
