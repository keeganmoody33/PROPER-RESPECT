import { linkPropText, type LinkPropCredit } from "@/src/domain/link-prop";

export function ProfileLinkProps({
  credits,
  viewerSignedIn,
}: {
  credits: readonly LinkPropCredit[];
  viewerSignedIn: boolean;
}) {
  if (!viewerSignedIn || credits.length === 0) return null;
  return (
    <ul className="link-props">
      {credits.map(credit => (
        <li key={`${credit.productSlug}:${credit.url}`} className="link-prop">{linkPropText(credit)}</li>
      ))}
    </ul>
  );
}
