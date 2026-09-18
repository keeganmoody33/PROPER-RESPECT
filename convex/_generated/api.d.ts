/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountRecovery from "../accountRecovery.js";
import type * as authHelpers from "../authHelpers.js";
import type * as connectors from "../connectors.js";
import type * as crons from "../crons.js";
import type * as discovery from "../discovery.js";
import type * as inventory from "../inventory.js";
import type * as inventoryTables from "../inventoryTables.js";
import type * as mailboxDiscovery from "../mailboxDiscovery.js";
import type * as mailboxGoogle from "../mailboxGoogle.js";
import type * as mailboxOAuthState from "../mailboxOAuthState.js";
import type * as mailboxTables from "../mailboxTables.js";
import type * as mailboxes from "../mailboxes.js";
import type * as manualProducts from "../manualProducts.js";
import type * as onboarding from "../onboarding.js";
import type * as privateEvidence from "../privateEvidence.js";
import type * as productBrandTables from "../productBrandTables.js";
import type * as productBrands from "../productBrands.js";
import type * as productKnowledge from "../productKnowledge.js";
import type * as productKnowledgeTables from "../productKnowledgeTables.js";
import type * as publicProfiles from "../publicProfiles.js";
import type * as publication from "../publication.js";
import type * as retainedEvidence from "../retainedEvidence.js";
import type * as seed from "../seed.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountRecovery: typeof accountRecovery;
  authHelpers: typeof authHelpers;
  connectors: typeof connectors;
  crons: typeof crons;
  discovery: typeof discovery;
  inventory: typeof inventory;
  inventoryTables: typeof inventoryTables;
  mailboxDiscovery: typeof mailboxDiscovery;
  mailboxGoogle: typeof mailboxGoogle;
  mailboxOAuthState: typeof mailboxOAuthState;
  mailboxTables: typeof mailboxTables;
  mailboxes: typeof mailboxes;
  manualProducts: typeof manualProducts;
  onboarding: typeof onboarding;
  privateEvidence: typeof privateEvidence;
  productBrandTables: typeof productBrandTables;
  productBrands: typeof productBrands;
  productKnowledge: typeof productKnowledge;
  productKnowledgeTables: typeof productKnowledgeTables;
  publicProfiles: typeof publicProfiles;
  publication: typeof publication;
  retainedEvidence: typeof retainedEvidence;
  seed: typeof seed;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
