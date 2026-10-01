import type { CSSProperties } from "react";

import styles from "./appIcon.module.css";

export type AppIconName =
  | "apple24"
  | "arrowLeft24"
  | "check16"
  | "google24"
  | "sealCheck20"
  | "shield24"
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
