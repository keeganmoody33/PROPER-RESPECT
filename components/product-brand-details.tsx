import type { ProductBrandSnapshot } from "@/src/domain/product-brand";

export function ProductBrandDetails({ snapshot }: { snapshot: ProductBrandSnapshot }) {
  const roles = Object.entries(snapshot.styleguide?.colors ?? {});

  return (
    <section className="product-brand-details" aria-label="Brand provenance">
      <h3>Brand identity</h3>
      <p>
        Presentation metadata from Context.dev. It does not verify account ownership or product use.
      </p>
      <dl className="brand-provenance">
        <div><dt>Provider</dt><dd>{snapshot.provider}</dd></div>
        <div><dt>Canonical domain</dt><dd>{snapshot.canonicalDomain}</dd></div>
        <div><dt>Retrieved</dt><dd><time dateTime={snapshot.retrievedAt}>{snapshot.retrievedAt}</time></dd></div>
        <div><dt>Adapter</dt><dd>{snapshot.adapterVersion}</dd></div>
        <div><dt>Retrieval</dt><dd>{snapshot.retrievalId}</dd></div>
        <div><dt>Response hash</dt><dd>{snapshot.responseHash}</dd></div>
      </dl>
      <h4>Logos</h4>
      {snapshot.logos.length > 0 ? (
        <p>{snapshot.logos.map((logo) => `${logo.mode} ${logo.type}`).join(" · ")}</p>
      ) : (
        <p>No brand logo returned. The existing product logo or initials are used.</p>
      )}
      <h4>Palette</h4>
      {snapshot.colors.length > 0 ? (
        <ul className="brand-palette">
          {snapshot.colors.map((color, index) => (
            <li key={`${color.hex}-${index}`}>
              <span className="brand-swatch" style={{ backgroundColor: color.hex }} aria-hidden="true" />
              <span>{color.hex}{color.name ? ` · ${color.name}` : ""}{color.source ? ` · ${color.source}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : <p>No palette returned. Existing card colors are used.</p>}
      <h4>Fonts</h4>
      {snapshot.fonts.length > 0 ? (
        <>
          <ul className="brand-fonts">
            {snapshot.fonts.map((font, index) => (
              <li key={`${font.family}-${index}`}>
                {font.family}
                {font.uses.length > 0 ? ` · ${font.uses.join(", ")}` : ""}
                {font.fallbacks.length > 0 ? ` · fallbacks: ${font.fallbacks.join(", ")}` : ""}
              </li>
            ))}
          </ul>
          <p>{snapshot.schemaVersion === 2 && snapshot.fontLinks.some(link => link.files.length > 0)
            ? "Retained font files are available for card typography, with local fallback fonts if an asset cannot load."
            : "Font names are recorded. No retained font files are available; the card uses fallback fonts."}</p>
        </>
      ) : <p>No fonts returned. Existing card fonts are used.</p>}
      <h4>Styleguide</h4>
      {snapshot.styleguide ? (
        <>
          {roles.length > 0 && (
            <ul className="brand-styleguide">
              {roles.map(([role, color]) => <li key={role}>{role}: {color}</li>)}
            </ul>
          )}
          {snapshot.styleguide.headingFamily && <p>Heading font: {snapshot.styleguide.headingFamily}</p>}
          {snapshot.styleguide.bodyFamily && <p>Body font: {snapshot.styleguide.bodyFamily}</p>}
          <p>Only explicit, readable color roles affect the card. Palette order does not assign roles.</p>
        </>
      ) : <p>No styleguide returned. Existing card styles are used.</p>}
      <details>
        <summary>Retrieval status{snapshot.partial ? " · partial" : ""}</summary>
        <ul className="brand-receipts">
          {snapshot.receipts.map((receipt) => (
            <li key={receipt.endpoint}>
              {receipt.endpoint}: {receipt.status}
              {receipt.httpStatus ? ` · HTTP ${receipt.httpStatus}` : ""}
              {receipt.partial ? " · partial" : ""}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
