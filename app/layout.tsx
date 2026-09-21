import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteFooter, SiteHeader } from "@/components/site-frame";
import { AppProviders } from "@/components/app-providers";
import { publicSiteOrigin } from "@/src/server/public-site";
import "./globals.css";

const archivo = localFont({ src: "./_homepage-fonts/Archivo.ttf", variable: "--homepage-sans", display: "swap", weight: "100 900" });
const mono = localFont({ src: "./_homepage-fonts/IBMPlexMono-Bold.ttf", variable: "--homepage-mono", display: "swap", weight: "700" });

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
      <body className={`${archivo.variable} ${mono.variable}`}>
        <AppProviders><SiteHeader /><div id="page-content" tabIndex={-1}>{children}</div><SiteFooter /></AppProviders>
      </body>
    </html>
  );
}
