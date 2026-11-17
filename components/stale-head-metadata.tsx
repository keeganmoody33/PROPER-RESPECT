"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// The tags this site's metadata writes. Charset, viewport, preloads, stylesheets and scripts are never touched.
const PAGE_METADATA = 'title, meta[name="description"], meta[name="robots"], meta[name^="twitter:"], meta[property^="og:"], link[rel="canonical"], link[rel="alternate"]';
// React tags every head element it renders or adopts with these expandos; its own hoistable cache skips the same ones.
const REACT_OWNED = ["__reactFiber$", "__reactMarker$"];

const ownedByReact = (tag: Element) => Object.keys(tag).some(key => REACT_OWNED.some(prefix => key.startsWith(prefix)));

// Next 16.4.6 hydrates each page's metadata after the page. Leaving before then unmounts it unhydrated, and React
// never claims the tags it hoisted, so the old page's canonical link stays beside the new one. No fiber points
// at those tags, so removing them after a navigation cannot disturb React. The first page is skipped: its tags
// are unowned only until they hydrate.
export function StaleHeadMetadata() {
  const pathname = usePathname();
  const shown = useRef(pathname);
  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    document.head.querySelectorAll(PAGE_METADATA).forEach(tag => { if (!ownedByReact(tag)) tag.remove(); });
  }, [pathname]);
  return null;
}
