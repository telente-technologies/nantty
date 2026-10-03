import type { CSSProperties } from "react";

import type { OverlayLayer, OverlayLayerType } from "@/types";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const ADDABLE: readonly { readonly type: OverlayLayerType; readonly label: string }[] = [
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "shape", label: "Shape" },
  { type: "countdown", label: "Countdown" },
  { type: "ticker", label: "Ticker" },
];

export function buildLayer(type: OverlayLayerType, index: number): OverlayLayer {
  const base = {
    id: `layer_${Date.now()}_${index}`,
    type,
    name: `${type.charAt(0).toUpperCase()}${type.slice(1)} ${index + 1}`,
    x: 120,
    y: 820,
    width: type === "shape" ? 240 : 640,
    height: type === "shape" ? 240 : 120,
    zIndex: 30 + index,
    opacity: 1,
  } as const;
  switch (type) {
    case "text":
      return { ...base, text: "Your headline here", fontSize: 56, color: "#ffffff", background: "#0b1752", radius: 8 };
    case "image":
      return { ...base, text: "Logo image URL", src: "", width: 220, height: 220, radius: 12 };
    case "shape":
      return { ...base, background: "#2043f5", radius: 16, x: 1600, y: 80 };
    case "countdown":
      return { ...base, text: "00:10:00", fontSize: 72, color: "#ffffff", background: "#0a0a14", radius: 12 };
    case "ticker":
      return { ...base, text: "Running text for your stream", fontSize: 44, color: "#0a0a14", background: "#f5e320", y: 980, height: 80 };
    default:
      return { ...base, text: "", color: "#ffffff" };
  }
}

export function layerStyle(layer: OverlayLayer): CSSProperties {
  return {
    left: `${(layer.x / CANVAS_WIDTH) * 100}%`,
    top: `${(layer.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(layer.width / CANVAS_WIDTH) * 100}%`,
    height: `${(layer.height / CANVAS_HEIGHT) * 100}%`,
    zIndex: layer.zIndex,
    opacity: layer.opacity,
    background: layer.background,
    borderRadius: layer.radius ? `${layer.radius}px` : undefined,
    fontSize: layer.fontSize ? `${layer.fontSize / 19.2}cqw` : undefined,
    color: layer.color,
  };
}
