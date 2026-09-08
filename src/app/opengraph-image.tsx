import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          justifyContent: "center",
          background: "#14532d",
          color: "#fafaf9",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 16,
            background: "#fafaf9",
            color: "#14532d",
            fontSize: 36,
            fontWeight: 700,
          }}
        >
          E
        </div>
        <div style={{ marginTop: 36, fontSize: 72, fontWeight: 700 }}>
          {SITE_NAME}
        </div>
        <div style={{ marginTop: 12, fontSize: 32, color: "#d6d3d1" }}>
          {SITE_TAGLINE}
        </div>
      </div>
    ),
    size,
  );
}
