import { TrustArticle } from "@/components/trust-article";
import { contactIdentity, trustDocuments, trustMetadata } from "@/src/server/trust-pages";

export function generateMetadata() {
  return trustMetadata("contact");
}

export default function ContactPage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactIdentity()).replace(/</g, "\\u003c") }} /><TrustArticle document={trustDocuments.contact} /></>;
}
