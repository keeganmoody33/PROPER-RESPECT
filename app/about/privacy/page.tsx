import { TrustArticle } from "@/components/trust-article";
import { trustDocuments, trustMetadata } from "@/src/server/trust-pages";

export function generateMetadata() {
  return trustMetadata("privacy");
}

export default function PrivacyPage() {
  return <TrustArticle document={trustDocuments.privacy} />;
}
