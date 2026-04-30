import { ImageResponse } from "next/og";
import { VEYA_ACCENT, VEYA_BG_ICON } from "@/lib/brand/constants";

export const runtime = "edge";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <span
          style={{
            fontSize: 19,
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
