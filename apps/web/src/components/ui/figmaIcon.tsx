import type { CSSProperties } from "react";

import styles from "./figmaIcon.module.css";

export type FigmaIconName =
  | "apple24" | "arrowLeft24" | "arrowUpRight24" | "bell24" | "boxArrowDown24" | "buildingStore20"
  | "cameraBolt24" | "cancel20" | "caretDown24" | "chatCircle24" | "check16" | "creditCard24" | "eyeClosed20"
  | "headset24" | "heart24" | "imageSquare24" | "magnifyingGlass24" | "mapPin24" | "minus16"
  | "paperPlaneTilt24" | "play24" | "plus16" | "refresh20" | "sealCheck20" | "shield24"
  | "speedometer24" | "squaresFour24" | "star16" | "tag24" | "textIndent24" | "truck24"
  | "userCircle24" | "videoCamera24" | "warning20";

interface FigmaIconProps {
  readonly name: FigmaIconName;
  readonly size?: number;
  readonly className?: string;
}

export function FigmaIconTintedWithCurrentColor({ name, size = 24, className }: FigmaIconProps) {
  const iconStyle = { "--icon-url": `url("/icons/${name}.svg")`, "--icon-size": `${size}px` } as CSSProperties;
  return <span aria-hidden="true" className={className ? `${styles.icon} ${className}` : styles.icon} style={iconStyle} />;
}
