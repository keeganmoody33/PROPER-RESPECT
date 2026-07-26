"use client";

import { useRef, useState } from "react";
import type { PublicProfile } from "@/src/domain/public-profile";

type Card = PublicProfile["cards"][number];

export function ProductCard({ card }: { card: Card }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openCard() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  function closeCard() {
    dialogRef.current?.close();
  }

  return (
    <article className="product-card">
      <div className="card-index" aria-hidden="true">
        01
      </div>
      <div className="product-mark" aria-hidden="true">
        GH
      </div>
      <div className="card-copy">
        <div className="status-row">
          <span>{card.status}</span>
          <span>IN USE</span>
        </div>
        <h3>{card.product.name}</h3>
        <p className="headline">{card.headline}</p>
        <p>{card.product.description}</p>
        <button ref={triggerRef} className="card-button" onClick={openCard}>
          Read the card back
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="card-back"
        aria-labelledby={`card-back-${card.product.slug}`}
        onClose={() => {
          setIsOpen(false);
          triggerRef.current?.focus();
        }}
        onCancel={() => setIsOpen(false)}
      >
        {isOpen && (
          <div>
            <div className="status-row">
              <span>CARD BACK</span>
              <span>{card.primaryLink.type}</span>
            </div>
            <h3 id={`card-back-${card.product.slug}`}>
              {card.product.name}
            </h3>
            <blockquote>“{card.note}”</blockquote>
            {card.startedAt && <p>In the stack since {card.startedAt}.</p>}
            <a
              className="outbound-link"
              href={card.primaryLink.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {card.primaryLink.label} ↗
            </a>
            <button className="close-button" onClick={closeCard}>
              Close card back
            </button>
          </div>
        )}
      </dialog>
    </article>
  );
}
