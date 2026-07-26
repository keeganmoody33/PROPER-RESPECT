#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const useEnvFile = !args.has("--no-env-file");

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const rawValue = line.slice(separator + 1).trim();
        const value =
          (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
          (rawValue.startsWith("'") && rawValue.endsWith("'"))
            ? rawValue.slice(1, -1)
            : rawValue;
        return [key, value];
      }),
  );
}

const fileEnvironment = useEnvFile ? parseEnvFile(".env.local") : {};
const environment = { ...fileEnvironment, ...process.env };
const errors = [];
const warnings = [];

function required(name, options = {}) {
  const value = environment[name]?.trim();
  if (!value) {
    if (options.serverOnly && !strict) {
      warnings.push(
        `${name} was not checked locally; confirm it is set on the Convex deployment.`,
      );
      return undefined;
    }
    errors.push(`${name} is required.`);
    return undefined;
  }
  return value;
}

function isPlaceholder(value) {
  return (
    /replace[_-]?me/i.test(value) ||
    /change[_-]?me/i.test(value) ||
    value.includes("your-deployment") ||
    value.includes("your-clerk-domain") ||
    value === "generate-a-long-random-secret"
  );
}

function validateHttpsUrl(name, value, hostSuffix) {
  if (!value) return;
  if (isPlaceholder(value)) {
    errors.push(`${name} still contains a placeholder.`);
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      errors.push(`${name} must use HTTPS.`);
    }
    if (hostSuffix && !url.hostname.endsWith(hostSuffix)) {
      errors.push(`${name} must point to a ${hostSuffix} deployment.`);
    }
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
}

const convexUrl = required("NEXT_PUBLIC_CONVEX_URL");
validateHttpsUrl("NEXT_PUBLIC_CONVEX_URL", convexUrl, ".convex.cloud");

const deployKey = environment.CONVEX_DEPLOY_KEY?.trim();
const deployKeyTarget = deployKey?.match(/^(?:prod|dev):([^|]+)\|/)?.[1];
if (convexUrl && deployKeyTarget) {
  try {
    const publicDeployment = new URL(convexUrl).hostname.replace(
      /\.convex\.cloud$/,
      "",
    );
    if (publicDeployment !== deployKeyTarget) {
      errors.push(
        "CONVEX_DEPLOY_KEY targets a different Convex deployment than NEXT_PUBLIC_CONVEX_URL.",
      );
    }
  } catch {
    // The URL validator above reports malformed values.
  }
}

const publishableKey = required("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
const secretKey = required("CLERK_SECRET_KEY");
const publishableMode = publishableKey?.match(/^pk_(test|live)_/)?.[1];
const secretMode = secretKey?.match(/^sk_(test|live)_/)?.[1];

if (publishableKey && !publishableMode) {
  errors.push(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must start with pk_test_ or pk_live_.",
  );
}
if (secretKey && !secretMode) {
  errors.push("CLERK_SECRET_KEY must start with sk_test_ or sk_live_.");
}
if (publishableMode && secretMode && publishableMode !== secretMode) {
  errors.push(
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must use the same Clerk environment.",
  );
}

for (const [name, expected] of [
  ["NEXT_PUBLIC_CLERK_SIGN_IN_URL", "/sign-in"],
  ["NEXT_PUBLIC_CLERK_SIGN_UP_URL", "/sign-up"],
  ["NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL", "/onboarding"],
  ["NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL", "/onboarding"],
]) {
  const value = required(name);
  if (value && value !== expected) {
    errors.push(`${name} must be ${expected}.`);
  }
}

const clerkFrontendApiUrl =
  environment.CLERK_FRONTEND_API_URL?.trim() ||
  environment.CLERK_JWT_ISSUER_DOMAIN?.trim();
if (!clerkFrontendApiUrl) {
  if (strict) {
    errors.push(
      "CLERK_FRONTEND_API_URL is required on the Convex deployment.",
    );
  } else {
    warnings.push(
      "CLERK_FRONTEND_API_URL was not checked locally; confirm it is set on the Convex deployment.",
    );
  }
} else {
  validateHttpsUrl("CLERK_FRONTEND_API_URL", clerkFrontendApiUrl);
  if (
    !environment.CLERK_FRONTEND_API_URL &&
    environment.CLERK_JWT_ISSUER_DOMAIN
  ) {
    warnings.push(
      "CLERK_JWT_ISSUER_DOMAIN is supported for compatibility; prefer CLERK_FRONTEND_API_URL.",
    );
  }
}

const encryptionKey = required("CONNECTOR_ENCRYPTION_KEY", {
  serverOnly: true,
});
if (encryptionKey && encryptionKey.length < 32) {
  errors.push("CONNECTOR_ENCRYPTION_KEY must contain at least 32 characters.");
}
if (encryptionKey && isPlaceholder(encryptionKey)) {
  errors.push("CONNECTOR_ENCRYPTION_KEY still contains a placeholder.");
}

if (warnings.length) {
  console.warn("Deployment configuration warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("Deployment configuration is not ready:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  strict
    ? "Deployment configuration is ready."
    : "Frontend deployment configuration is ready. Run with --strict in a protected environment to require Convex-only variables.",
);
