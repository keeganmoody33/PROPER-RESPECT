# Proper Respect public-profile reading plugin

Created by lecturesfrom · Contact: 33@lecturesfrom.com · Updated: 2026-09-23.

This package supplies one self-contained skill for reading an owner-published Proper Respect profile and preserving the meaning of its evidence. Supply the intended public profile URL. Public reading requires no account. The package contains no account connection, editing, publication, hooks or MCP server components.

## Package and discovery

The package root is `public/agent-plugins/proper-respect` in the [official source repository](https://github.com/keeganmoody33/PROPER-RESPECT). Root `plugin.json` follows [Agent Plugins 1.0.0](https://agent-plugins.org/specification). `.codex-plugin/plugin.json` supplies Codex metadata for the same `skills/` directory. A compatible client can load this directory; client installation and distribution behavior varies.

[Download the skill](https://proper-respect.com/agent-plugins/proper-respect/skills/read-public-profile/SKILL.md) or inspect the [website skill index](https://proper-respect.com/.well-known/agent-skills/index.json). The index follows the [draft discovery 0.2.0 contract](https://github.com/cloudflare/agent-skills-discovery-rfc) and identifies the exact Markdown bytes with SHA-256. The path-absolute artifact URL resolves against the index origin, so a configured deployment can serve the same bytes without embedding its origin in the skill.

## Install in Codex

Register the official GitHub marketplace and install the plugin:

```sh
codex plugin marketplace add keeganmoody33/PROPER-RESPECT --ref main
codex plugin add proper-respect@proper-respect-official
```

The repository's `.agents/plugins/marketplace.json` selects this package for the `proper-respect-official` marketplace. A fresh Codex session should expose `proper-respect:read-public-profile`. Ask it to read a specific published profile, for example: "Read https://proper-respect.com/keegan. Which tools are published, and what usage evidence is available?"

As checked on September 23, `/keegan` is the live published example. The owner's desired `/lecturesfrom` canonical migration is pending; that path currently returns 404. The skill still requires the user's intended public profile URL and does not guess or substitute a handle. See the [release reconciliation](https://github.com/keeganmoody33/PROPER-RESPECT/blob/main/docs/verification/2026-09-23-release-documentation-reconciliation.md).

Remote GitHub installation and fresh-session skill discovery were verified with Codex 0.153.4 on September 22, 2026, against source `32a851f18632af984e56ab2d761ebc47be870340`. The website download and discovery index were verified on production. This does not establish a skills.sh listing or Ora's acceptance of the plugin manifest.

For local development, substitute the checkout's absolute path for `keeganmoody33/PROPER-RESPECT` and omit `--ref main`.

To remove the package:

```sh
codex plugin remove proper-respect@proper-respect-official
codex plugin marketplace remove proper-respect-official
```

The reading instructions are entirely in `skills/read-public-profile/SKILL.md`. Copying that file is sufficient for the skill; copying this directory preserves both plugin formats. Do not copy the repository's coding-agent `AGENTS.md` into the reading skill.

## Install the skill with the skills CLI

To install just the reading skill for Codex in the current project:

```sh
npx skills add https://github.com/keeganmoody33/PROPER-RESPECT/tree/main/public/agent-plugins/proper-respect --skill read-public-profile --agent codex
```

Discovery and installation from this package URL were verified with skills 1.7.0 on September 22, 2026. The installed Markdown matched the published index digest. This verifies a download and install path, not a skills.sh directory listing. The [skills CLI documentation](https://skills.sh/docs/cli) describes its installation telemetry and opt-out settings.

After modifying the skill, recompute the index digest from its raw bytes and keep the index description equal to its frontmatter description. The package contract test verifies those relationships. Production availability and browser WebMCP support require separate runtime verification.
