import Image from "next/image";

import shared from "./landingPage.module.css";
import styles from "./landingSteps.module.css";

const steps = [
  {
    title: "Join the Creator Program",
    description: "In the Nantty app, open Profile, then Creator Program. Some accounts are approved straight away; others get a quick review with a checklist.",
    media: { kind: "photo", src: "/photos/deskStreamSetup.webp", alt: "A creator at his desk setting up a stream on a large monitor", width: 1600, height: 1067 },
  },
  {
    title: "Sign in to Studio",
    description: "Use the same Nantty account. No new password, no separate sign-up. Your control room, overlays and earnings are ready.",
    media: { kind: "screen", src: "/screens/studioControlRoomLight.webp", alt: "The Studio control room in light mode with stream settings and live stats", width: 1440, height: 880 },
  },
  {
    title: "Go live and get paid",
    description: "Go live from your phone or OBS, invite guests, start a battle and withdraw what you earn to your bank.",
    media: { kind: "photo", src: "/photos/couchGamerControllers.webp", alt: "A gamer on a couch with two controllers in front of a big screen", width: 1600, height: 1067 },
  },
] as const;

export function LandingSteps() {
  return (
    <section id="creator-program" className={`${shared.section} ${styles.section}`} aria-labelledby="steps-heading">
      <div className={shared.inner}>
        <div className={shared.intro}>
          <p className={shared.eyebrow}>How it works</p>
          <h2 id="steps-heading" className={shared.heading}>
            From the app to your first live in three steps.
          </h2>
          <p className={shared.lede}>Studio is open to approved members of the Nantty Creator Program. Apply in the Nantty app, then come back here.</p>
        </div>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.stepCard}>
              <div className={styles.stepText}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </div>
              <div className={`${styles.imageWindow} ${step.media.kind === "screen" ? styles.screenWindow : ""}`}>
                <Image src={step.media.src} alt={step.media.alt} width={step.media.width} height={step.media.height} sizes="(max-width: 900px) 92vw, 380px" className={step.media.kind === "screen" ? styles.screenshot : styles.photo} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
