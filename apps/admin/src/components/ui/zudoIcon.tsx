import type { CSSProperties, ReactNode } from "react";

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

export function IconLabel({ name, size = 14, children, className }: { readonly name: ZudoIconName; readonly size?: number; readonly children: ReactNode; readonly className?: string }) {
  return (
    <span className={className ? `${styles.iconLabel} ${className}` : styles.iconLabel}>
      <ZudoIcon name={name} size={size} />
      {children}
    </span>
  );
}
