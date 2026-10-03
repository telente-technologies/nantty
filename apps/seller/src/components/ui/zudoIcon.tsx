import type { CSSProperties, ReactNode } from "react";

import styles from "./zudoIcon.module.css";

export type ZudoIconName = "arrowDown24" | "arrowRight24" | "arrowUp24" | "caretUp24" | "caretUpDown24" | "arrowLeft24" | "arrowsOutSimple24" | "arrowUpRight24" | "bell24" | "bellRinging24" | "bookmarkSimple24" | "boxArrowDown24" | "buildingStore20" | "calendarDots16" | "camera24" | "cancel20" | "caretDown24" | "caretRight24" | "chatCircle24" | "check16" | "copy16" | "creditCard24" | "dotsThreeVertical24" | "export24" | "eye20" | "eyeClosed20" | "headset24" | "heart24" | "image24" | "imageSquare24" | "magnifyingGlass20" | "mapPin24" | "minus16" | "paperPlaneTilt24" | "plus16" | "question24" | "refresh20" | "repeat24" | "sealCheck20" | "share24" | "shield24" | "shoppingCart24" | "slidersHorizontal24" | "speakerHigh24" | "speedometer24" | "squaresFour24" | "star16" | "tag24" | "textIndent24" | "trash24" | "truck24" | "userCircle24" | "userProfile45" | "videoCamera24" | "warning20";

interface ZudoIconProps {
  readonly name: ZudoIconName;
  readonly size?: number;
  readonly className?: string;
  readonly label?: string;
}

export function ZudoIcon({ name, size = 20, className, label }: ZudoIconProps) {
  const iconStyle = { "--icon-url": `url("/icons/${name}.svg")`, "--icon-size": `${size}px` } as CSSProperties;
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={className ? `${styles.icon} ${className}` : styles.icon}
      style={iconStyle}
    />
  );
}

export function IconLabel({ name, size = 14, children, className }: { readonly name: ZudoIconName; readonly size?: number; readonly children: ReactNode; readonly className?: string }) {
  return (
    <span className={className ? `${styles.iconLabel} ${className}` : styles.iconLabel}>
      <ZudoIcon name={name} size={size} />
      {children}
    </span>
  );
}
