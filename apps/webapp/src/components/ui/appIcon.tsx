import type { CSSProperties, ReactNode } from "react";

import styles from "./appIcon.module.css";

export type AppIconName =
  | "apple24"
  | "arrowLeft24"
  | "bell24"
  | "bookmarkSimple24"
  | "buildingStore20"
  | "cameraBolt24"
  | "cancel20"
  | "caretDown24"
  | "caretRight24"
  | "chatCircle24"
  | "check16"
  | "coin24"
  | "creditCard24"
  | "dotsThreeVertical24"
  | "eye24"
  | "flips34"
  | "gift24"
  | "google24"
  | "heart24"
  | "home33"
  | "imageSquare24"
  | "lockSimple24"
  | "magnifyingGlass24"
  | "mapPin24"
  | "paperPlaneTilt24"
  | "play24"
  | "plus24"
  | "sealCheck20"
  | "share24"
  | "shield24"
  | "shoppingCart24"
  | "slidersHorizontal24"
  | "speedometer24"
  | "squaresFour24"
  | "star16"
  | "tag24"
  | "textIndent24"
  | "trash24"
  | "truck24"
  | "userCircle24"
  | "videoCamera24"
  | "warning20"
  | "arrowDown24"
  | "arrowUp24"
  | "musicNotes24"
  | "note24"
  | "package24"
  | "searchOff24"
  | "shoppingBag24"
  | "sparkle24";

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

interface IconLabelProps {
  readonly name: AppIconName;
  readonly size?: number;
  readonly children: ReactNode;
  readonly className?: string;
}

export function IconLabel({ name, size = 14, children, className }: IconLabelProps) {
  return (
    <span className={className ? `${styles.iconLabel} ${className}` : styles.iconLabel}>
      <AppIcon name={name} size={size} />
      {children}
    </span>
  );
}
