import { notFound } from "next/navigation";
import { InventoryFixture } from "./view";

export default function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.PROPER_RESPECT_E2E_REFERENCE !== "1") notFound();
  return <main className="onboarding-shell"><h1>Synthetic inventory interaction check</h1><p>No real owner, evidence, provider call, or backend persistence is included in this fixture.</p><InventoryFixture /></main>;
}
