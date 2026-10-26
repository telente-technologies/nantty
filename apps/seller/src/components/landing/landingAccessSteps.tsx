import styles from "./landingAccessSteps.module.css";

const accessSteps = [
  { title: "Start selling in the app", description: "In the Nantty app, go to Profile › Start selling and set up your store. In Nigeria you can start selling straight away and verify your payout account to withdraw. Outside Nigeria, verify your identity before you sell.", image: "/photos/shopkeeperPhone.webp", imageAlt: "A shop owner in an apron checking his phone at his stall", kind: "photo" as const },
  { title: "Sign in here — it is free", description: "Every Nantty seller can use the dashboard on the Free plan. No Gold verification or paid plan needed.", image: "/photos/boutiqueFriends.webp", imageAlt: "Two women shopping between clothing racks in a boutique", kind: "photo" as const },
  { title: "Upgrade when you grow", description: "Your store, products, orders and wallet are already waiting. Move to Pro or Business for bulk tools, advanced analytics, a team and more.", image: "/screenshots/dashboardOverview.webp", imageAlt: "The dashboard home after signing in", kind: "screenshot" as const },
];

export function LandingAccessSteps() {
  return (
    <section id="access" className={styles.section} aria-labelledby="access-heading">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>How to get access</p>
        <h2 id="access-heading" className={styles.heading}>
          Three steps from the app to running your business.
        </h2>
        <ol className={styles.steps}>
          {accessSteps.map((step, stepIndex) => (
            <li key={step.title} className={styles.stepCard}>
              <div className={styles.stepText}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {stepIndex + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDescription}>{step.description}</p>
              </div>
              <div className={`${styles.imageWindow} ${step.kind === "screenshot" ? styles.screenshotWindow : ""}`}>
                <img src={step.image} alt={step.imageAlt} loading="lazy" width={1400} height={933} className={step.kind === "screenshot" ? styles.screenshot : styles.photo} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
