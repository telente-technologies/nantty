import { ImageResponse } from "next/og";

export const alt = "Zudomart: shop the sellers you already watch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#2043F5", color: "#fff" }}>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>zudomart</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>Shop the sellers</div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 88, fontWeight: 800, lineHeight: 1.1, letterSpacing: -4 }}>
            you already
            <span style={{ marginLeft: 24, padding: "0 20px", background: "#F5E320", color: "#000", borderRadius: 16 }}>watch.</span>
          </div>
        </div>
        <div style={{ fontSize: 30, color: "#D2DAFD" }}>Posts, clips and live shopping. Payments held in escrow until delivery.</div>
      </div>
    ),
    size,
  );
}
