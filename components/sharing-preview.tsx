"use client";

import { useState } from "react";
import type { PublicProfile } from "@/src/domain/public-profile";
import { ProductCard } from "./product-card";
import { ProfileLinks, ProfileName } from "./profile-identity";

export function SharingPreview({ profile, current, busy, onPublish, refreshAccounts = [] }: {
  profile: PublicProfile; current: boolean; busy: boolean; onPublish: () => void;
  refreshAccounts?: { accountLabel: string }[];
}) {
  const [approved, setApproved] = useState(false);
  return <section className="sharing-preview" aria-labelledby="sharing-preview-title">
    <h3 id="sharing-preview-title">Your visitor’s view</h3>
    <p>This is the public information after your selected changes, including previously approved cards that you kept. Private originals and unselected details are excluded.</p>
    {!current && <p role="status">Your saved collection or sharing choices changed. Preview again before publishing.</p>}
    {profile.cards.some(card => card.usageLink) && <p>The links on the backs of these cards open only if their own sharing settings allow it. Check that each shows nothing private, like other people’s contact details.</p>}
    <div className="card-grid">{profile.cards.map((card, index) => <ProductCard key={`${card.product.slug}-${index}`} card={card} index={index} goTo={card.goTo} />)}</div>
    {!profile.cards.length && <p>No products will be public.</p>}
    <footer className="profile-footer"><div><strong><ProfileName profile={profile} /></strong><span>@{profile.handle}</span></div><p>{profile.bio}</p><ProfileLinks profile={profile} /></footer>
    {refreshAccounts.map((account, index) => <p key={index}>Daily GitHub refresh will read activity from {account.accountLabel} and update the approved metric on your public card. Reconnecting requires a fresh sharing preview and approval.</p>)}
    <label className="sharing-preview-confirmation"><input type="checkbox" checked={approved} disabled={!current || busy} onChange={event => setApproved(event.target.checked)} />I approve making exactly this preview visible to anyone with the public link.</label>
    <button type="button" className="primary-action" disabled={!current || busy || !approved} onClick={onPublish}>{busy ? "Publishing…" : "Publish this preview"}</button>
  </section>;
}
