import type { CSSProperties } from "react";

import styles from "./appIcon.module.css";

export type AppIconName =
  | "apple24"
  | "arrowLeft24"
  | "bell24"
  | "buildingStore20"
  | "cancel20"
  | "caretDown24"
  | "caretRight24"
  | "chatCircle24"
  | "check16"
  | "creditCard24"
  | "dotsThreeVertical24"
  | "eye24"
  | "google24"
  | "heart24"
  | "home33"
  | "imageSquare24"
  | "lockSimple24"
  | "magnifyingGlass24"
  | "mapPin24"
  | "plus24"
  | "sealCheck20"
  | "share24"
  | "shield24"
  | "shoppingCart24"
  | "slidersHorizontal24"
  | "speedometer24"
  | "star16"
  | "tag24"
  | "trash24"
  | "truck24"
  | "userCircle24"
  | "warning20";

const MULTI_COLOUR_ICONS: ReadonlySet<AppIconName> = new Set(["google24"]);

interface AppIconProps {
  readonly name: AppIconName;
  readonly size?: number;
  readonly className?: string;
}

export function AppIcon({ name, size = 24, className }: AppIconProps) {
  if (MULTI_COLOUR_ICONS.has(name)) {
    return (
      <img
        src={`/icons/${name}.svg`}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={className ? `${styles.coloured} ${className}` : styles.coloured}
        style={{ width: size, height: size }}
      />
    );
  }

  const iconStyle = { "--icon-url": `url("/icons/${name}.svg")`, "--icon-size": `${size}px` } as CSSProperties;
  return <span aria-hidden="true" className={className ? `${styles.tinted} ${className}` : styles.tinted} style={iconStyle} />;
}
