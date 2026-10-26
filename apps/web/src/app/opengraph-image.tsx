import { ImageResponse } from "next/og";

export const alt = "Nantty: social commerce, made whole";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#243cf4", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 46, fontWeight: 800, letterSpacing: -2 }}>Nantty</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>Shop the sellers</div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 88, fontWeight: 800, lineHeight: 1.1, letterSpacing: -4 }}>
            you already
            <span style={{ marginLeft: 24, padding: "0 20px", background: "#F5E320", color: "#000", borderRadius: 16 }}>watch.</span>
          </div>
        </div>
          <div style={{ fontSize: 30, color: "#e2e7ff" }}>Social commerce, made whole. Discover through people, stories and live moments.</div>
      </div>
    ),
    size,
  );
}
