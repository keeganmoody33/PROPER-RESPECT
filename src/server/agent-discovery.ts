import { publicSiteOrigin } from "./public-site";
import { markdownWithMetadata, type MarkdownMetadata } from "./markdown-metadata";

export const repositoryUrl = "https://github.com/keeganmoody33/PROPER-RESPECT";
export const homepageUpdatedAt = "2026-09-23T00:00:00.000Z";

export function creatorBusinessIdentity() {
  return {
    "@id": new URL("/about/contact#organization", publicSiteOrigin()).href,
    "@type": "Organization",
    name: "lecturesfrom",
    address: { "@type": "PostalAddress", addressCountry: "US" },
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "33@lecturesfrom.com" },
  };
}

export function productIdentity() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Proper Respect",
    url: publicSiteOrigin().href,
    description: "Build a private collection of the tools you use. Add your experience and usage evidence where available, then choose which cards to share on your profile.",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    sameAs: [repositoryUrl],
    creator: creatorBusinessIdentity(),
  };
}

export function publicSiteGuide() {
  const origin = publicSiteOrigin();
  const product = productIdentity();
  return {
    name: product.name,
    description: product.description,
    homepage: origin.href,
    documentation: {
      agents: new URL("/agents.md", origin).href,
      authentication: new URL("/auth.md", origin).href,
      homepageMarkdown: new URL("/index.md", origin).href,
      origins: new URL("/about/origins.md", origin).href,
      contact: new URL("/about/contact.md", origin).href,
      privacy: new URL("/about/privacy.md", origin).href,
    },
    profileReading: {
      tool: "get_current_public_profile",
      input: {},
      procedure: [
        "Open the published Proper Respect profile URL supplied by the user. This guide does not look up or read profiles.",
        "On that profile page, call get_current_public_profile with {} when document.modelContext is supported. Otherwise read the visible published cards and state that method.",
        "Preserve the displayed source, dates, coverage, estimates, and evidence caveats. A missing or unpublished profile returns 404 and has no profile tool.",
      ],
    },
    limits: [
      "Public reading only. A public profile URL grants no access to private collections, sources, or account controls.",
      "These browser tools do not connect providers, edit records, or publish cards. No public HTTP API or remote MCP server is offered.",
      "Unknown usage is not zero. Captured activity does not establish an owner's relationship or rank importance. Homepage usage examples are sample data, not connected account measurements.",
    ],
  };
}

export type PublicSiteGuide = ReturnType<typeof publicSiteGuide>;

export function homepageMarkdown() {
  const origin = publicSiteOrigin();
  return `# Proper Respect

Your tools. Your track record.

${productIdentity().description}

## How it works

1. Start with one tool. Sign in and add a product manually or connect a supported source. Keep what you find in your private collection.
2. Keep the context. Record what you use, what you are testing, and what you have moved on from. Add your own notes and choose your go-to tools.
3. Preview every choice. Select the saved cards and details you want to share. Review the exact preview before you approve publication.

Private by default. Shared by choice. Activity does not rank importance. Homepage usage examples contain sample data, not connected account measurements.

Created by lecturesfrom, a business in the United States. [Contact: 33@lecturesfrom.com](${new URL("/about/contact", origin)}).

## Links

- [Start your collection](${new URL("/app/collection", origin)}).
- [View Keegan's shared collection](${new URL("/lecturesfrom", origin)}).
- [Agent instructions and WebMCP usage](${new URL("/agents.md", origin)}).
- [Authentication boundaries](${new URL("/auth.md", origin)}).
- [Origins](${new URL("/about/origins.md", origin)}).
- [Contact](${new URL("/about/contact.md", origin)}).
- [How your data is handled](${new URL("/about/privacy.md", origin)}).
- [Public source repository](${repositoryUrl}).
`;
}

export function authenticationMarkdown() {
  const origin = publicSiteOrigin();
  return `# Proper Respect authentication

## Public reading

The [homepage](${origin}) and published profile pages are readable without an account. The homepage get_public_site_guide tool returns public documentation links and a profile-reading procedure without looking up a profile. The browser-only get_current_public_profile tool reads the published profile on the current page. It does not require a separate API token.

## Private collections

People sign in through the Clerk interface at [Your collection](${new URL("/app/collection", origin)}). Each person uses their own identity. A public profile URL grants no access to its owner's private collection, sources, credentials, or publication controls.

No agent API keys or OAuth token exchange are offered. Proper Respect does not provide a remote MCP server, service-account flow, or supported private HTTP API. Do not extract session cookies or request passwords, verification codes, or provider tokens from a person. Do not reuse internal application endpoints as an agent API.

## Errors and access changes

A missing or unpublished profile returns HTTP 404 and registers no WebMCP tool. Leaving a public profile removes its tool. An owner can change what is published through their signed-in collection. Revisit the public page to inspect its current published state. There is no agent credential to issue or revoke.

See [agent instructions](${new URL("/agents.md", origin)}) for the supported read-only workflow and evidence caveats.
`;
}

export function agentCatalog() {
  const origin = publicSiteOrigin();
  return {
    specVersion: "1.0",
    entries: [{
      "@context": "https://agenticresourcediscovery.org/context/v1",
      identifier: `urn:air:${origin.hostname}:docs:public-profile`,
      displayName: "Proper Respect public-profile reading guide",
      type: "text/markdown",
      url: new URL("/agents.md", origin).href,
      description: "Instructions for reading an owner-published tool collection and using its read-only browser WebMCP tool. This is documentation, not a remote MCP endpoint.",
      representativeQueries: [
        "How do I read a person's published tool collection on Proper Respect?",
        "How should I interpret the usage evidence on a Proper Respect profile?",
      ],
    }],
  };
}

export function markdownResponse(body: string, metadata: MarkdownMetadata) {
  return new Response(markdownWithMetadata(body, metadata), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
