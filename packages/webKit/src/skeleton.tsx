/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { CSSProperties } from "react";

import styles from "./feedback.module.css";

interface SkeletonProps {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly circle?: boolean;
  readonly className?: string;
}

export function Skeleton({ width = "100%", height = 14, circle = false, className }: SkeletonProps) {
  const sizeStyle: CSSProperties = { width, height };
  return <span aria-hidden="true" className={[styles.skeleton, circle ? styles.skeletonCircle : "", className ?? ""].join(" ")} style={sizeStyle} />;
}
