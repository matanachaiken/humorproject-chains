import { cookies } from "next/headers";
import { THEMES, type Theme } from "@/lib/themes";

export async function getTheme(): Promise<Theme> {
  const saved = (await cookies()).get("theme")?.value;
  return THEMES.find((t) => t === saved) ?? "system";
}
