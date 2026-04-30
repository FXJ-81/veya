import type { MetadataRoute } from "next";
import { VEYA_ACCENT, VEYA_BG_ROOT, VEYA_SITE_DESCRIPTION } from "@/lib/brand/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Veya",
    short_name: "Veya",
    description: VEYA_SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: VEYA_BG_ROOT,
    theme_color: VEYA_ACCENT,
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
