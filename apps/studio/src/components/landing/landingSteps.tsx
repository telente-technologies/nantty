import shared from "./landingPage.module.css";
import styles from "./landingSteps.module.css";

const steps = [
  { title: "Create a live", body: "Give your stream a title and pick a category: just chatting, gaming, music, education or shopping." },
  { title: "Connect your source", body: "Push RTMP from OBS, or stream straight from your phone." },
  { title: "Build the overlay", body: "Add your logo, gift goal or lower third, then paste the browser source into OBS." },
];

export function LandingSteps() {
  return (
    <section className={`${shared.section} ${shared.sectionMuted}`} id="how">
      <div className={shared.sectionInner}>
        <div className={shared.sectionHead}>
          <p className={shared.eyebrow}>How it works</p>
          <h2 className={shared.sectionTitle}>Three steps to your first stream.</h2>
        </div>
        <ol className={styles.list}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.index}>{index + 1}</span>
              <div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
