import styles from "./horizontalBarList.module.css";

export interface HorizontalBarItem {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly displayValue: string;
  readonly detail?: string;
}

export function HorizontalBarList({ title, items, colorVariable = "--blue-500", emptyText = "No data for this period." }: { readonly title: string; readonly items: readonly HorizontalBarItem[]; readonly colorVariable?: string; readonly emptyText?: string }) {
  const largestValue = Math.max(0, ...items.map((item) => item.value));
  if (items.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  return (
    <ol className={styles.list} aria-label={title}>
      {items.map((item) => (
        <li key={item.key} className={styles.row}>
          <div className={styles.labels}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value}>{item.displayValue}</span>
          </div>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.bar} style={{ width: `${largestValue > 0 ? Math.max(2, (item.value / largestValue) * 100) : 0}%`, background: `var(${colorVariable})` }} />
          </span>
          {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}
