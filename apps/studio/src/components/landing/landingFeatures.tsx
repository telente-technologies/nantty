import shared from "./landingPage.module.css";
import styles from "./landingFeatures.module.css";

const features = [
  {
    title: "Connect OBS or any encoder",
    body: "Grab a server URL and stream key, paste them into OBS, and you are broadcasting to Zudomart.",
  },
  {
    title: "Overlays you control",
    body: "Lower thirds, logos, shapes, countdowns and tickers on a 1920×1080 canvas, sent to your stream as a browser source.",
  },
  {
    title: "Go live from your phone",
    body: "Stream from the camera, share your screen while you play, or hand off to an external encoder.",
  },
  {
    title: "Sell while you stream",
    body: "Pin products to the live so viewers can check out without leaving the stream.",
  },
  {
    title: "Live chat, one inbox",
    body: "Read and reply to stream comments from the same control room as your encoder status.",
  },
  {
    title: "Post analytics",
    body: "Impressions, unique viewers and profile visits for every live and every post you own.",
  },
];

export function LandingFeatures() {
  return (
    <section className={shared.section} id="features">
      <div className={shared.sectionInner}>
        <div className={shared.sectionHead}>
          <p className={shared.eyebrow}>Everything in one control room</p>
          <h2 className={shared.sectionTitle}>Built for people who stream to sell.</h2>
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
