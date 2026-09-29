import styles from "./sparkline.module.css";

export function Sparkline({ values, label, width = 96, height = 28 }: { readonly values: readonly number[]; readonly label: string; readonly width?: number; readonly height?: number }) {
  if (values.length < 2) return null;
  const maximum = Math.max(...values, 0) || 1;
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${((index / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - (value / maximum) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} role="img" aria-label={label} className={styles.sparkline}>
      <path d={path} className={styles.line} />
    </svg>
  );
}
