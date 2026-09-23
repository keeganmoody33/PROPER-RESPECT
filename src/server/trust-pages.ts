import type { Metadata } from "next";
import { publicSiteOrigin } from "./public-site";
import { markdownResponse } from "./agent-discovery";

export type TrustSlug = "origins" | "contact" | "privacy";
type TrustSection = Readonly<{
  heading: string;
  paragraphs: readonly string[];
  links?: readonly { label: string; href: string }[];
}>;
export type TrustDocument = Readonly<{
  title: string;
  description: string;
  eyebrow: string;
  updatedAt: string;
  introduction: readonly string[];
  sections: readonly TrustSection[];
}>;

export const trustDocuments: Readonly<Record<TrustSlug, TrustDocument>> = {
  origins: {
    title: "Giving credit its context",
    description: "Why Proper Respect keeps experience and evidence alongside the tools we use.",
    eyebrow: "Origins / Lineage",
    updatedAt: "2026-09-22",
    introduction: [
      "Proper Respect takes its name from the idea behind giving someone their props: recognizing what they have contributed.",
    ],
    sections: [
      {
        heading: "Respect between people",
        paragraphs: [
          'Aretha Franklin offered a clear statement of the principle. Speaking to Vogue in 2016 about Respect, she said: "As people, we deserve respect from one another."',
        ],
        links: [{ label: "Aretha Franklin interviewed by Alex Frank, Vogue", href: "https://www.vogue.com/article/aretha-franklin-interview-carole-king" }],
      },
      {
        heading: "What it means here",
        paragraphs: [
          "Our product brings its own question to that idea: how do you give a useful tool its due? A name in a list can tell someone what you use. Your experience explains why it matters, what changed when you tried it, and whether you still come back to it.",
          "Proper Respect is a place to keep that context. Build a collection of tools you use and test. Add notes and supporting evidence where it exists. Choose your go-to tools, keep the history, and decide which saved cards and details to share.",
          "For us, giving props means making recognition specific. Credit the tool and explain the experience. Keep the evidence close enough to inspect, and leave room for the story to change.",
          "Created by lecturesfrom, a business in the United States. Operated by Keegan Moody.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact Proper Respect",
    description: "Contact Keegan Moody about Proper Respect, created by lecturesfrom, for product questions, corrections and data requests.",
    eyebrow: "Contact",
    updatedAt: "2026-09-22",
    introduction: [
      "Created by lecturesfrom, a business in the United States. Operated by Keegan Moody.",
      "You can contact Keegan at 33@lecturesfrom.com about Proper Respect, your collection, a problem with the site, or a question about how your data is handled.",
    ],
    sections: [
      {
        heading: "Questions and corrections",
        paragraphs: [
          "Tell us which page or product card you are asking about and what you expected to happen. For a bug, include the steps that led to it and the device or browser you used. A public page URL helps us identify the right record.",
          "If a description or usage figure seems wrong, tell us what needs checking. A published card reflects the information its owner selected; it is not a guarantee of complete activity or independent verification.",
        ],
        links: [{ label: "Email Keegan Moody", href: "mailto:33@lecturesfrom.com" }],
      },
      {
        heading: "Account and data requests",
        paragraphs: [
          "Use the same contact address for questions about access, retained evidence or deletion. Describe the request without attaching private originals or sending credentials. Do not send passwords, verification codes, session cookies or provider tokens.",
          "The data-handling page explains the current limits of disconnecting a source and removing evidence. A complete self-service account deletion workflow is not available.",
        ],
        links: [{ label: "How your data is handled", href: "/about/privacy" }],
      },
    ],
  },
  privacy: {
    title: "How your data is handled",
    description: "Current account, evidence, connection and publication behavior in Proper Respect, including retention and deletion limits.",
    eyebrow: "Privacy / Current practices",
    updatedAt: "2026-09-22",
    introduction: [
      "This page describes how Proper Respect handles accounts, evidence and publication as of September 22, 2026.",
      "Proper Respect is created by lecturesfrom, a business in the United States, and operated by Keegan Moody. Contact 33@lecturesfrom.com with questions about your data.",
    ],
    sections: [
      {
        heading: "Your account and private collection",
        paragraphs: [
          "Clerk handles sign-in. Convex stores application records and uploaded evidence. Account records include an authentication identifier, your handle, display name, profile information and saved links. Your collection can contain product relationships, notes, dates, costs and supporting evidence.",
          "Private collection access is tied to your signed-in identity. Evidence records can include source URLs, original uploads, message metadata, observations, excerpts and capture history. These records are stored by the service; they are not kept only on your device.",
        ],
      },
      {
        heading: "Connected sources",
        paragraphs: [
          "Connecting Gmail grants read-only Gmail access, a broader permission than the metadata the current reader requests. The reader requests message identifiers, timestamps and the From, Subject and Date headers. It does not request message bodies or attachments. These headers can contain personal information, and unmatched headers can be retained as private evidence.",
          "New and reconnected mailboxes start with scheduled maintenance disabled. The collection provides controls for supported reads and maintenance. Saved mailbox credentials are encrypted by the application; this does not mean all stored evidence is end-to-end encrypted.",
          "Supported activity connections can retain snapshots and their measurement periods. For example, the GitHub connection requests account information and a contribution calendar for a one-year period. A snapshot does not establish complete usage, every repository or all work performed.",
        ],
      },
      {
        heading: "What becomes public",
        paragraphs: [
          "Saving a collection and publishing it are separate actions. You select saved cards and details, review an exact preview, then approve publication. Visitors and browser agents can read the resulting public profile without signing in. Raw mailbox evidence and credentials are not part of that public profile.",
          "Review your display name, biography and links as well as the cards in the preview. A display name may initially come from your sign-in identity, including an email address. Removing every public card can leave your public name, profile information and an empty collection visible; it does not delete the published identity.",
        ],
      },
      {
        heading: "Disconnecting and deleting are different",
        paragraphs: [
          "Disconnecting a mailbox removes its saved credentials and stops future reads through that connection. Existing private evidence, source history and relationship history are retained. Disconnecting locally does not revoke the grant in your Google account. You can separately revoke the app through your provider's account permissions.",
          "Activity-connector disconnection removes the local saved secret and stops that connection's updates. Existing snapshots, relationships and published cards can remain. It does not establish that a linked provider account or its grant has been removed.",
          "Deleting an original evidence payload does not erase all information derived from it. Observations, excerpts, source identifiers, hashes, provenance, relationships and published records may remain. A complete self-service account deletion workflow and automatic evidence-expiry schedule are not implemented. Disconnecting or deleting an original does not fully erase your data.",
        ],
      },
      {
        heading: "Services and browser storage",
        paragraphs: [
          "Product presentation can use Context.dev and official product sources. Brand lookups send the product domain to the branding service. Product images and fonts can load from external hosts, so visiting a page can make requests to those hosts.",
          "Your appearance preference is saved in your browser's local storage. Authentication and hosting services also process requests and may use cookies and logs as part of their services.",
        ],
      },
      {
        heading: "Questions about your data",
        paragraphs: [
          "Contact Keegan Moody at 33@lecturesfrom.com about access, retained evidence or deletion. Describe what you need without sending passwords, tokens or private originals. The disconnecting and deletion section above explains what the application currently retains.",
        ],
        links: [{ label: "Contact Proper Respect", href: "/about/contact" }],
      },
    ],
  },
};

export function trustMetadata(slug: TrustSlug): Metadata {
  const document = trustDocuments[slug];
  const url = new URL(`/about/${slug}`, publicSiteOrigin()).href;
  return {
    title: document.title,
    description: document.description,
    alternates: { canonical: url, types: { "text/markdown": `${url}.md` } },
    openGraph: { type: "website", title: document.title, description: document.description, url },
  };
}

export function trustMarkdown(slug: TrustSlug): string {
  const document = trustDocuments[slug];
  const sections = document.sections.map(section => [
    `## ${section.heading}`,
    ...section.paragraphs,
    ...(section.links || []).map(link => `- [${link.label}](${new URL(link.href, publicSiteOrigin()).href})`),
  ].join("\n\n"));
  return [`# ${document.title}`, `Updated ${document.updatedAt}`, ...document.introduction, ...sections].join("\n\n") + "\n";
}

export function trustMarkdownResponse(slug: TrustSlug) {
  const document = trustDocuments[slug];
  const response = markdownResponse(trustMarkdown(slug), {
    title: document.title,
    description: document.description,
    canonical: new URL(`/about/${slug}`, publicSiteOrigin()),
  });
  if (process.env.VERCEL_ENV === "preview") response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export function contactIdentity() {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: trustDocuments.contact.title,
    url: new URL("/about/contact", publicSiteOrigin()).href,
    mainEntity: {
      "@type": "Organization",
      name: "lecturesfrom",
      address: { "@type": "PostalAddress", addressCountry: "US" },
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "33@lecturesfrom.com" },
    },
  };
}
