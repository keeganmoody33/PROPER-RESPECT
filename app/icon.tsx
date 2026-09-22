import { brandIcon } from "@/src/server/site-identity-image";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return brandIcon(size.width);
}
