import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import { publicSiteOrigin } from "@/src/server/public-site";
import "./globals.css";

export function generateMetadata(): Metadata {
  return {
    metadataBase: publicSiteOrigin(),
    title: {
      default: "PROPER—RESPECT",
      template: "%s — PROPER—RESPECT",
    },
    description: "The tools you use, test, and come back to, with the history and context behind your choices.",
    ...(process.env.VERCEL_ENV === "preview" ? { robots: { index: false, follow: false } } : {}),
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
