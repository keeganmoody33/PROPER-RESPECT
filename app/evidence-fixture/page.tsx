import { notFound } from "next/navigation";
import { EvidenceFixture } from "./view";

export default function Page() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.PROPER_RESPECT_E2E_REFERENCE !== "1"
  )
    notFound();
  return <EvidenceFixture />;
}
