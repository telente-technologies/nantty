import styles from "./creatorProgramGate.module.css";

const webappUrl = process.env.NEXT_PUBLIC_WEBAPP_URL ?? "http://localhost:3500";

export function CreatorProgramGate() {
  return (
    <section className={styles.gate} aria-labelledby="creatorProgramGateTitle">
      <h1 id="creatorProgramGateTitle" className={styles.title}>
        Join the Creator Program
      </h1>
      <p className={styles.description}>
        Studio is for approved creators. Join the program to go live, receive gifts and grow your audience. Selling is optional.
      </p>
      <a href={`${webappUrl}/creator`} className={styles.joinLink}>
        Join the Creator Program
      </a>
    </section>
  );
}
