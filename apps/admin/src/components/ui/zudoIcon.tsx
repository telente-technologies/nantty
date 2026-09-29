import type { CSSProperties } from "react";

import type { ZudoIconName } from "@/constants/zudoIconNames.constant";

import styles from "./zudoIcon.module.css";

interface ZudoIconProps {
  readonly name: ZudoIconName;
  readonly size?: number;
  readonly className?: string;
  readonly label?: string;
}

export function ZudoIcon({ name, size = 16, className, label }: ZudoIconProps) {
  const iconStyle = { "--icon-url": `url("/icons/${name}.svg")`, "--icon-size": `${size}px` } as CSSProperties;
  return <span aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} className={className ? `${styles.icon} ${className}` : styles.icon} style={iconStyle} />;
}
