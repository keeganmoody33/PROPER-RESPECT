"use client";

import { SignInButton } from "@clerk/nextjs";
import { firstResultReturnUrl, firstResultSources } from "@/src/client/first-result-intent";
import { SourcePicker, useFirstResultSource } from "./first-result";
import { StackPicker } from "./stack-builder";

export function SignedOutCollection({ session }: { session: "signed-out" | "checking" }) {
  const source = useFirstResultSource();
  const label = firstResultSources.find(option => option.id === source)?.label;
  return <main className="onboarding-shell">
    <p className="onboarding-kicker">PROPER RESPECT / PRIVATE FIRST</p>
    <h1>Start your collection</h1>
    <p>Pick the tools you use, are testing or used before. After you sign in, your list is saved privately. You choose a handle and what to share later.</p>
    <StackPicker mode={{ kind: session }} />
    <section className="onboarding-panel" aria-labelledby="usage-data-title">
      <p className="onboarding-kicker">OPTIONAL / IF YOU HAVE IT</p>
      <h2 id="usage-data-title">Already have usage data?</h2>
      <p>You can also bring in an account or a file you already have. What you bring in stays private too.</p>
      <SourcePicker selected={source} />
      {session === "signed-out" && <SignInButton mode="modal" forceRedirectUrl={firstResultReturnUrl(source)} signUpForceRedirectUrl={firstResultReturnUrl(source)}>
        <button type="button" className="secondary-action">{source ? `Continue with ${label}` : "Sign in"}</button>
      </SignInButton>}
    </section>
  </main>;
}
