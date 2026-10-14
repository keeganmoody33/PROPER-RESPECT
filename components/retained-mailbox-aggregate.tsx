import type { PublicRetainedSource } from "@/src/domain/retained-mailbox-aggregate";

export function RetainedMailboxAggregate({ sources }: { sources: readonly PublicRetainedSource[] }) {
  if (sources.length === 0) return null;
  return (
    <section className="stack" aria-labelledby="retained-mailboxes-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">RETAINED ACCOUNTS</p>
          <h2 id="retained-mailboxes-heading">Retained sources</h2>
        </div>
      </div>
      <ul>
        {sources.map(source => (
          <li key={source.accountId}>
            <p>{source.label}</p>
            <p>{source.recording === "stopped" ? "Recording stopped" : "Recording"}</p>
            <p>{`${source.retainedCount} retained ${source.retainedCount === 1 ? "row" : "rows"}`}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
