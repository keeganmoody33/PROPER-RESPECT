"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { searchablePublicPath } from "@/src/client/searchable-path";

function PublicFrame({ pathname }: { pathname: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [initialPath] = useState(pathname);
  const sendPath = () => frame.current?.contentWindow?.postMessage({ type: "searchable-public-path", pathname }, "*");

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "searchable-public-path", pathname }, "*");
  }, [pathname]);

  return <iframe
    ref={frame}
    title="Public page visit analytics"
    hidden
    sandbox="allow-scripts"
    referrerPolicy="no-referrer"
    src={`/api/analytics/searchable?path=${encodeURIComponent(initialPath)}`}
    onLoad={sendPath}
  />;
}

export function SearchableAnalyticsFrame() {
  const pathname = searchablePublicPath(usePathname());
  return pathname === null ? null : <PublicFrame pathname={pathname} />;
}
