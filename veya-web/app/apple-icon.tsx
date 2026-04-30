import { ImageResponse } from "next/og";
import { VEYA_ACCENT, VEYA_BG_ICON } from "@/lib/brand/constants";

export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: VEYA_BG_ICON,
          borderRadius: 40,
        }}
      >
        <span
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: VEYA_ACCENT,
            fontFamily: "Arial, Helvetica, sans-serif",
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          V
        </span>
      </div>
    ),
    { ...size },
  );
}
