#!/usr/bin/env bash
# The release gate. Every job in .github/workflows/release.yml runs this before
# it does anything else, so re-running one deploy job checks it again.
#
# GitHub offers required reviewers on a private repository only on Enterprise,
# so this gate doesn't rely on them: while the repository is private, the
# owner's tag push is the only approval. Needs RELEASE_OWNER, ACTOR,
# TRIGGERING_ACTOR and GH_TOKEN (actions: read) beside the variables Actions sets.
set -euo pipefail

# RELEASE_OWNER is the one account that may release, pinned in release.yml. It
# is not GITHUB_REPOSITORY_OWNER: since 2026-11-23 the repository belongs to the
# lecturesfrom organization, which never pushes a tag itself.
# triggering_actor is whoever started this attempt, so a re-run by anyone else
# stops here too.
if [ -z "${RELEASE_OWNER:-}" ]; then
  echo "RELEASE_OWNER is not set, so no one can release."
  exit 1
fi
for who in "$ACTOR" "$TRIGGERING_ACTOR"; do
  if [ "$who" != "$RELEASE_OWNER" ]; then
    echo "Only $RELEASE_OWNER can release. This run was started by $who."
    exit 1
  fi
done

# The check above lives in the tagged commit, and a tag can point at a commit
# that rewrites it. Two repository settings close that: a tag ruleset lets only
# the owner create, move or delete v* tags, and each deploy environment hands
# its secrets only to v* tags. Both are read here, so a release stops if either
# is missing or can't be read. The token can't read a ruleset's bypass list;
# docs/DEPLOYMENT.md says who may be on it.
work="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/release-gate.XXXXXX")"
trap 'rm -rf "$work"' EXIT
cd "$work"
api() {
  # Prints the HTTP status; the body goes to the file named first.
  curl --silent --output "$1" --write-out '%{http_code}' \
    -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
    "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/$2"
}
for name in production-backend production-frontend; do
  status="$(api environment.json "environments/$name")"
  if [ "$status" != "200" ]; then
    echo "Could not read the $name environment (HTTP $status). Create it first."
    exit 1
  fi
  status="$(api policies.json "environments/$name/deployment-branch-policies")"
  if [ "$status" != "200" ]; then
    echo "Could not read which branches and tags may deploy to $name (HTTP $status)."
    exit 1
  fi
  if ! jq -e '.deployment_branch_policy.custom_branch_policies == true' environment.json > /dev/null ||
    ! jq -e '
      (.branch_policies // []) as $policies
      | ($policies | length > 0)
        and ($policies | all(.type == "tag" and .name == "v*"))
    ' policies.json > /dev/null; then
    echo "The $name environment must deploy from v* tags only (Settings, Environments, $name, Deployment branches and tags)."
    exit 1
  fi
done
status="$(api rulesets.json "rulesets?includes_parents=false&per_page=100")"
if [ "$status" != "200" ]; then
  echo "Could not read the repository's rulesets (HTTP $status)."
  exit 1
fi
protected=no
for id in $(jq -r '.[] | select(.target == "tag" and .enforcement == "active") | .id' rulesets.json); do
  status="$(api ruleset.json "rulesets/$id")"
  if [ "$status" != "200" ]; then
    echo "Could not read ruleset $id (HTTP $status)."
    exit 1
  fi
  if jq -e '
    [.rules[]?.type] as $types
    | .target == "tag" and .enforcement == "active"
      and ((.conditions.ref_name.include // []) | any(. == "refs/tags/v*" or . == "~ALL"))
      and ((.conditions.ref_name.exclude // []) | length == 0)
      and (["creation", "update", "deletion"] | all(. as $rule | $types | index($rule) != null))
  ' ruleset.json > /dev/null; then
    protected=yes
  fi
done
if [ "$protected" != "yes" ]; then
  echo "No active tag ruleset restricts creating, updating and deleting v* tags. See docs/DEPLOYMENT.md, Release a tagged version."
  exit 1
fi
