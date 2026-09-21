"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function AppProviders({ children }: { children: React.ReactNode }) {
  if (!clerkKey || !convex) return children;

  return (
    <ClerkProvider publishableKey={clerkKey} appearance={{ variables: {
      colorPrimary: "#171713",
      colorForeground: "#171713",
      colorBackground: "#fbfaf6",
      colorInput: "#ffffff",
      borderRadius: "0.125rem",
      fontFamily: "var(--homepage-sans), Arial, sans-serif",
    } }}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
