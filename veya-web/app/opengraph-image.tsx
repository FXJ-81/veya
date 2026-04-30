import { ImageResponse } from "next/og";
import {
  VEYA_ACCENT,
  VEYA_BG_ROOT,
  VEYA_SITE_DESCRIPTION,
  VEYA_TEXT,
} from "@/lib/brand/constants";

export const runtime = "edge";

export const alt = "Veya — Manage your money";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: `linear-gradient(145deg, ${VEYA_BG_ROOT} 0%, #12121f 48%, #0d0d18 100%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 26,
              background: "#11111c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid rgba(91,110,245,0.35)`,
            }}
          >
            <span
              style={{
                fontSize: 68,
                fontWeight: 800,
                color: VEYA_ACCENT,
                fontFamily: "Arial, Helvetica, sans-serif",
                lineHeight: 1,
              }}
            >
              V
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: VEYA_TEXT,
                fontFamily: "Arial, Helvetica, sans-serif",
                letterSpacing: "-0.03em",
              }}
            >
              Veya
            </span>
            <span
              style={{
                fontSize: 30,
                fontWeight: 500,
                color: "rgba(248,248,255,0.72)",
                fontFamily: "Arial, Helvetica, sans-serif",
                maxWidth: 880,
                lineHeight: 1.35,
              }}
            >
              {VEYA_SITE_DESCRIPTION}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
