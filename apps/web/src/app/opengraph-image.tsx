import { defaultZudomartWordmarkVariant, zudomartSymbolBounds, zudomartSymbolPath, zudomartWordmarkFor } from "@zudomart/web-kit";
import { ImageResponse } from "next/og";

export const alt = "Zudomart: shop the sellers you already watch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const wordmark = zudomartWordmarkFor(defaultZudomartWordmarkVariant, 64);
const symbol = zudomartSymbolBounds;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#3A2BFF", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width={(40 * symbol.width) / symbol.height} height={40} viewBox={`${symbol.x} ${symbol.y} ${symbol.width} ${symbol.height}`}>
            <path d={zudomartSymbolPath()} fill="#FFFFFF" />
          </svg>
          <svg width={(64 * wordmark.width) / wordmark.height} height={64} viewBox={`0 0 ${wordmark.width} ${wordmark.height}`}>
            <path d={wordmark.d} fill="#FFFFFF" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>Shop the sellers</div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 88, fontWeight: 800, lineHeight: 1.1, letterSpacing: -4 }}>
            you already
            <span style={{ marginLeft: 24, padding: "0 20px", background: "#F5E320", color: "#000", borderRadius: 16 }}>watch.</span>
          </div>
        </div>
        <div style={{ fontSize: 30, color: "#D8D5FF" }}>Posts, clips and live shopping. Payments held in escrow until delivery.</div>
      </div>
    ),
    size,
  );
}
