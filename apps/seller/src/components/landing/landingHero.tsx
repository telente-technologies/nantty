import styles from "./landingHero.module.css";

export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="landing-hero-heading">
      <div className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Zudomart Dashboard · for Gold sellers</p>
          <h1 id="landing-hero-heading" className={styles.heading}>
            Your counter, your stockroom and your online store on <span className={styles.receiptTag}>one screen.</span>
          </h1>
          <p className={styles.lede}>
            The back office and point of sale for verified Zudomart businesses. Ring up sales at the counter, ship marketplace orders, manage stock across shops, and get paid out of escrow — with the same account as your app.
          </p>
          <form action="/login" method="get" className={styles.signInPill}>
            <label htmlFor="hero-identifier" className="visuallyHidden">
              Email, username or phone number
            </label>
            <input id="hero-identifier" name="identifier" type="text" autoComplete="username" placeholder="Email, username or phone" maxLength={254} className={styles.signInInput} />
            <button type="submit" className={styles.signInButton}>
              Sign in with your Zudomart account
            </button>
          </form>
          <ul className={styles.proofList}>
            <li>Same account as the app</li>
            <li>Keeps selling offline</li>
            <li>Escrow payouts to your bank</li>
          </ul>
        </div>
        <div className={styles.stage}>
          <div className={styles.stagePanel} aria-hidden="true" />
          <figure className={styles.browserFrame}>
            <div className={styles.browserBar} aria-hidden="true">
              <span />
              <span />
              <span />
              <p>dashboard.zudomart.com</p>
            </div>
            <img src="/screenshots/dashboardOverview.webp" alt="The dashboard home: sales today, a 30-day revenue chart, wallet balances and online orders by status" width={1440} height={900} className={styles.browserScreenshot} />
          </figure>
          <figure className={styles.tabletFrame}>
            <img src="/screenshots/posRegister.webp" alt="The register on a tablet with a receipt-style cart" width={1180} height={820} className={styles.tabletScreenshot} />
          </figure>
          <p className={`${styles.chip} ${styles.offlineChip}`}>
            <span className={styles.chipDot} aria-hidden="true" />
            Offline? Sales queue up and sync when you are back.
          </p>
          <p className={`${styles.chip} ${styles.escrowChip}`}>
            <span className={styles.chipBadge} aria-hidden="true">
              ✓
            </span>
            Escrow released to your wallet after delivery
          </p>
        </div>
      </div>
    </section>
  );
}
