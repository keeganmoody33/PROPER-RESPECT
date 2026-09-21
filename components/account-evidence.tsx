"use client";

import { usePaginatedQuery } from "convex/react";
import { Component, useEffect, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AssociatedAccountEvidence } from "@/src/domain/product-destination";
import { compareAccountEvidence } from "@/src/domain/account-evidence";

type Props = {
  propId: Id<"props">;
  productSlug: string;
  children: (evidence: AssociatedAccountEvidence[], progress: ReactNode) => ReactNode;
};

function GitHubAccountEvidence({ propId, children }: Omit<Props, "productSlug">) {
  const { results, status, loadMore } = usePaginatedQuery(api.inventory.accountEvidencePage, { propId }, { initialNumItems: 3 });
  const [scanThrough, setScanThrough] = useState(30);
  const connected = results.find(row => row.connected)?.candidate;
  const complete = Boolean(connected) || status === "Exhausted";
  useEffect(() => {
    if (!complete && status === "CanLoadMore" && results.length < scanThrough) loadMore(3);
  }, [complete, status, results.length, loadMore, scanThrough]);
  const candidates = results.flatMap(row => row.candidate ? [row.candidate] : []);
  const evidence = connected ? [connected.evidence] : complete ? candidates.sort(compareAccountEvidence).map(candidate => candidate.evidence) : [];
  const progress = connected ? <p>Account link uses your connected GitHub account.</p> : <div>
    <p role="status">{complete
      ? `Account lookup complete: ${results.length} retained records checked.`
      : `Account lookup incomplete: ${results.length} retained records checked. Historical account links are available after the lookup completes.`}</p>
    {!complete && results.length >= scanThrough && <button type="button" className="secondary-action" disabled={status !== "CanLoadMore"} onClick={() => setScanThrough(results.length + 30)}>Check 30 more retained records</button>}
  </div>;
  return children(evidence, progress);
}

class AccountLookupBoundary extends Component<Omit<Props, "productSlug">, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return this.props.children([], <div role="status">
      <p>Account lookup is unavailable. Your saved links and collection are unchanged.</p>
      <button type="button" className="secondary-action" onClick={() => this.setState(state => ({ failed: false, attempt: state.attempt + 1 }))}>Retry account lookup</button>
    </div>);
    return <GitHubAccountEvidence key={this.state.attempt} {...this.props} />;
  }
}

export function AccountEvidence({ productSlug, ...props }: Props) {
  return productSlug === "github" ? <AccountLookupBoundary key={props.propId} {...props} /> : props.children([], null);
}
