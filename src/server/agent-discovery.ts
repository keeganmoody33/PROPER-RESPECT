import { publicSiteOrigin } from "./public-site";

export const repositoryUrl = "https://github.com/keeganmoody33/PROPER-RESPECT";
export const homepageUpdatedAt = "2026-09-21T00:00:00.000Z";

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
  };
}

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

The [homepage](${origin}) and published profile pages are readable without an account. The browser-only get_current_public_profile tool reads the published profile on the current page. It does not require a separate API token.

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

export function markdownResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
