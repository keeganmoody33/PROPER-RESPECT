import { brandIcon } from "@/src/server/site-identity-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIcon(size.width);
}
