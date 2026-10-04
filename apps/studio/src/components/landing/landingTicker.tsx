import { landingTickerItems } from "./landingContent.constant";
import styles from "./landingTicker.module.css";

function TickerList({ isDecorativeCopy }: { readonly isDecorativeCopy: boolean }) {
  return (
    <ul className={styles.list} aria-hidden={isDecorativeCopy || undefined}>
      {landingTickerItems.map((item) => (
        <li key={item} className={styles.item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function LandingTicker() {
  return (
    <section className={styles.ticker} aria-label="What Studio does">
      <div className={styles.track}>
        <TickerList isDecorativeCopy={false} />
        <TickerList isDecorativeCopy />
      </div>
    </section>
  );
}
