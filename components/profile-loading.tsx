import { ProductCardSkeleton } from "./product-card-skeleton";

export function ProfileLoading() {
  return (
    <main>
      <div className="profile-context"><p>SHARED PRODUCT COLLECTION</p></div>
      <section className="stack" aria-labelledby="stack-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TOOLS WITH A TRACK RECORD</p>
            <h1 id="stack-heading" className="visually-hidden">Shared product collection</h1>
            <span className="product-card-skeleton-ghost profile-loading-name" data-dim="240×48" aria-hidden="true" />
          </div>
        </div>
        <ProductCardSkeleton
          label="Loading shared product collection…"
          log="PROFILE · LOADING"
          count={3}
        />
      </section>
    </main>
  );
}
