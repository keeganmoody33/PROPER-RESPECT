import { ImageResponse } from "next/og";
import { publicSiteOrigin } from "@/src/server/public-site";

export function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: "#f0eee6", color: "#181914", padding: "72px" }}>
      <div style={{ display: "flex", fontSize: 28, letterSpacing: 3 }}>PROPER—RESPECT</div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 86, fontWeight: 700 }}>
        <div>Your tools.</div>
        <div>Your track record.</div>
      </div>
      <div style={{ display: "flex", fontSize: 28 }}>{publicSiteOrigin().host}</div>
    </div>,
    { width: 1200, height: 630 },
  );
}
