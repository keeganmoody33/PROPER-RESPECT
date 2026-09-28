import type { Metadata } from "next";
import { publicSiteOrigin } from "./public-site";
import { creatorBusinessIdentity, markdownResponse } from "./agent-discovery";

export type TrustSlug = "origins" | "contact" | "privacy" | "terms";
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
    updatedAt: "2026-09-28",
    introduction: [
      "This page describes how Proper Respect handles accounts, evidence and publication as of September 28, 2026.",
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
          "Proper Respect's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
        ],
        links: [{ label: "Google API Services User Data Policy", href: "https://developers.google.com/terms/api-services-user-data-policy" }],
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
        heading: "How to request deletion",
        paragraphs: [
          "Email 33@lecturesfrom.com from the address you sign in with. Say whether you want your whole account deleted, specific evidence removed, or your public profile taken down, and include your handle. Do not send passwords, tokens or private originals.",
          "Deletion is handled by hand while a self-service workflow is not available. We will reply to confirm what was deleted and to name anything that remains, such as records described in the section on disconnecting and deleting above.",
        ],
        links: [{ label: "Email a deletion request", href: "mailto:33@lecturesfrom.com" }],
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
  terms: {
    title: "Terms of use",
    description: "The rules for using Proper Respect and publishing a public profile, including what may be removed and how.",
    eyebrow: "Terms / Using Proper Respect",
    updatedAt: "2026-09-28",
    introduction: [
      "These terms apply when you use Proper Respect, including when you keep a private collection or publish a public profile. Proper Respect is created by lecturesfrom, a business in the United States, and operated by Keegan Moody.",
      "By creating an account or publishing a profile, you agree to these terms. If you do not agree, do not use the service.",
    ],
    sections: [
      {
        heading: "Acceptable use",
        paragraphs: [
          "Use Proper Respect to record and share your own experience with the tools you use. Do not publish anything unlawful, anything that infringes someone else's rights, or anything that harasses or threatens a person.",
          "Do not impersonate a person or company, or suggest that a company endorses you when it does not. Do not publish false claims about a product, or evidence you know to be altered.",
          "Do not try to reach another person's private collection, get around sign-in or other security, overload the service, or use it to distribute spam or malicious code.",
        ],
      },
      {
        heading: "Your content and our right to display it",
        paragraphs: [
          "You keep ownership of what you add: your notes, evidence, links and profile details. Your collection stays private until you choose cards and details to publish.",
          "When you publish, you allow us to store, reproduce and display the published content on your public profile, in its Markdown and structured versions, and to the browser agents and tools that read public profiles. We use this permission only to operate Proper Respect. It ends for future display when you unpublish, although copies that others already made may remain.",
          "You are responsible for having the right to publish what you share, including any logos, screenshots or quotes.",
        ],
      },
      {
        heading: "What we may remove and how",
        paragraphs: [
          "Anyone can report a public profile with the \"Report this page\" link on it or by email. We may take down a public profile, or refuse to publish it, if it breaks these terms, if the law requires it, or while we review a report.",
          "A taken-down profile stops being shown publicly, and republishing is paused until the review ends. Your private collection is not deleted. Where we can, we will tell you what was removed and why, and you can reply to ask us to look again.",
        ],
      },
      {
        heading: "Disclose affiliate and referral links",
        paragraphs: [
          "If you earn money, credit or another benefit when someone uses a link on your profile, or if you are paid by, employed by or otherwise connected to a product you share, say so plainly on that card. Follow the rules on endorsements and advertising that apply where you live.",
          "We may remove a link or card that hides a paid relationship.",
        ],
      },
      {
        heading: "No warranty",
        paragraphs: [
          "Proper Respect is provided as it is and as it is available, without any warranty. We do not promise that it will always be available, free of errors, or suitable for a particular purpose.",
          "Published cards reflect what their owners chose to share. We do not verify them, and a card is not a guarantee of anyone's complete activity or a recommendation from us.",
        ],
      },
      {
        heading: "Changes to these terms",
        paragraphs: [
          "We may update these terms. The date at the top of this page shows the latest version. If a change affects what we may do with your content, we will say so on this page before it takes effect.",
          "Continuing to use Proper Respect after a change means you accept the updated terms.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          "Questions about these terms, reports and appeals go to 33@lecturesfrom.com. The data-handling page explains what we keep and how to request deletion.",
        ],
        links: [
          { label: "Email Proper Respect", href: "mailto:33@lecturesfrom.com" },
          { label: "How your data is handled", href: "/about/privacy" },
        ],
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
    mainEntity: creatorBusinessIdentity(),
  };
}
