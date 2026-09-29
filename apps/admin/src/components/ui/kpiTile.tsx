import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./kpiTile.module.css";

export function Sparkline({ values, label }: { readonly values: readonly number[]; readonly label: string }) {
  if (values.length < 2) return null;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - ((value - minimum) / spread) * 26}`).join(" ");
  return (
    <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

interface KpiTileProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly detail?: ReactNode;
  readonly href?: string;
  readonly tone?: "default" | "attention";
  readonly children?: ReactNode;
}

export function KpiTile({ label, value, detail, href, tone = "default", children }: KpiTileProps) {
  const content = (
    <>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {detail ? <div className={styles.detail}>{detail}</div> : null}
      {children}
    </>
  );
  const className = `${styles.tile} ${tone === "attention" ? styles.attention : ""}`;
  return href ? (
    <Link href={href} className={`${className} ${styles.linked}`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
