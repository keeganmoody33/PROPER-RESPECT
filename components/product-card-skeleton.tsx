import { MeasuredBlueprint, UsageChart } from "./usage-chart";

export function ProductCardSkeleton({
  label,
  log,
  count = 1,
}: {
  label: string;
  log?: string;
  count?: number;
}) {
  const cards = Math.max(1, count);
  return (
    <div className="product-card-skeleton-status" role="status" aria-busy="true">
      <p className="visually-hidden">{label}</p>
      <div className={cards > 1 ? "card-grid" : undefined}>
        {Array.from({ length: cards }, (_, index) => (
          <MeasuredBlueprint key={index} className="product-card-skeleton">
            <div className="product-card-skeleton-top">
              <span className="product-card-skeleton-ghost" data-dim="72×14" />
              <span className="product-card-skeleton-ghost product-card-skeleton-ghost-wide" data-dim="140×14" />
            </div>
            <span className="product-card-skeleton-ghost product-card-skeleton-title" data-dim="200×26" />
            <span className="product-card-skeleton-ghost product-card-skeleton-sub" data-dim="260×16" />
            <span className="product-card-skeleton-ghost product-card-skeleton-metric" data-dim="180×40" />
            <UsageChart loading framed={false} log={index === 0 ? log : undefined} />
            <div className="product-card-skeleton-foot">
              <span className="product-card-skeleton-ghost" data-dim="120×13" />
              <span className="product-card-skeleton-ghost" data-dim="90×13" />
            </div>
          </MeasuredBlueprint>
        ))}
      </div>
    </div>
  );
}
