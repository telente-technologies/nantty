import shared from "./landingPage.module.css";
import styles from "./landingFeatures.module.css";

const features = [
  {
    title: "Connect OBS or any encoder",
    body: "Grab a server URL and stream key and broadcast your game, console or studio setup to Zudomart.",
  },
  {
    title: "Overlays you control",
    body: "Lower thirds, logos, gift goals, countdowns and tickers on a 1920×1080 canvas, sent to your stream as a browser source.",
  },
  {
    title: "Go live from your phone",
    body: "Stream from the camera, share your screen while you play, or hand off to an external encoder.",
  },
  {
    title: "Battles and guests",
    body: "Bring up to several guests on stage or battle another creator and let the audience decide with gifts.",
  },
  {
    title: "Gifts and earnings",
    body: "Viewers send gifts and subscribe to your channel. Track coins, top gifters and battle results per live.",
  },
  {
    title: "Sell if you want to",
    body: "Have a store? Pin products to your live. No store? Studio works exactly the same without them.",
  },
];

export function LandingFeatures() {
  return (
    <section className={shared.section} id="features">
      <div className={shared.sectionInner}>
        <div className={shared.sectionHead}>
          <p className={shared.eyebrow}>Everything in one control room</p>
          <h2 className={shared.sectionTitle}>Built for every kind of creator.</h2>
        </div>
        <ul className={styles.grid}>
          {features.map((feature) => (
            <li key={feature.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardBody}>{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
