import { v, type Infer } from "convex/values";

// Missing on pre-binding rows. Never infer these values from a mutable login.
export const githubRefreshBindingValidator = v.object({
  providerAccountId: v.string(),
  generation: v.number(),
});
export type GithubRefreshBinding = Infer<typeof githubRefreshBindingValidator>;

export function validGithubRefreshBinding(binding: GithubRefreshBinding | undefined): binding is GithubRefreshBinding {
  return binding !== undefined && /^[\x21-\x7e]{1,256}$/.test(binding.providerAccountId) &&
    Number.isSafeInteger(binding.generation) && binding.generation > 0;
}

export function sameGithubRefreshBinding(approved: GithubRefreshBinding | undefined, current: GithubRefreshBinding | undefined) {
  return validGithubRefreshBinding(approved) && validGithubRefreshBinding(current) &&
    approved.providerAccountId === current.providerAccountId && approved.generation === current.generation;
}
