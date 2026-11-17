import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { publicSiteOrigin } from "@/src/server/public-site";
import { publicBrandMark } from "@/src/server/site-identity-image";

export async function GET() {
  const [mark, archivo] = await Promise.all([
    publicBrandMark(),
    readFile(join(process.cwd(), "app/_homepage-fonts/Archivo-Black-Latin.ttf")),
  ]);
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: "#ffe600", color: "#000000", padding: "56px 64px", fontFamily: "Archivo" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 32, fontWeight: 900 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mark} alt="" width={72} height={60} />
        <span>PROPER RESPECT</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 150, lineHeight: 0.9, fontWeight: 900, letterSpacing: -6 }}>
        <div>EARN YOUR</div>
        <div>RESPECT.</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "4px solid #000000", paddingTop: 24, fontSize: 24, fontWeight: 600 }}>
        <div>Private by default. Shared by choice.</div>
        <div>{publicSiteOrigin().host}</div>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [{ name: "Archivo", data: archivo, weight: 900, style: "normal" }] },
  );
}
