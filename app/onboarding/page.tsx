import Link from "next/link";
import { OnboardingClient } from "@/components/onboarding-client";

export default function OnboardingPage() {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  if (!configured) {
    return (
      <main className="system-message">
        <p className="eyebrow">SETUP REQUIRED</p>
        <h1>Authentication is ready to configure.</h1>
        <p>
          Add the Clerk and Convex environment values from <code>.env.example</code>{" "}
          to enable account creation.
        </p>
        <Link className="text-link" href="/keegan">
          View the reference profile →
        </Link>
      </main>
    );
  }

  return <OnboardingClient />;
}
