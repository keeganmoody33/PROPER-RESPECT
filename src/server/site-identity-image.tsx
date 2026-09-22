import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export async function publicBrandMark() {
  const mark = await readFile(join(process.cwd(), "public/brand/homepage/PR-mark-black.png"));
  return `data:image/png;base64,${mark.toString("base64")}`;
}

export async function brandIcon(size: number) {
  const mark = await publicBrandMark();
  const width = Math.round(size * 0.875);
  const height = Math.round(width * 856 / 1024);
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#f0eee7" }}>
      {/* ImageResponse requires a plain image rather than next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mark} alt="" width={width} height={height} />
    </div>,
    { width: size, height: size },
  );
}
