import { buildContactMailtoLinkForBothAddresses, contactEmailDisplayText } from "@/constants/contact.constant";

import { landingQuestions } from "./landingContent.constant";
import { LandingIcon } from "./landingIcons";
import styles from "./landingFaq.module.css";

export function LandingFaq() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-heading">
      <div className={styles.layout}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>FAQ</p>
          <h2 id="faq-heading" className={styles.heading}>
            Questions, answered.
          </h2>
          <p className={styles.contactNote}>
            Something else? Email <a href={buildContactMailtoLinkForBothAddresses("Zudomart Studio question")}>{contactEmailDisplayText}</a>.
          </p>
        </div>
        <div className={styles.list}>
          {landingQuestions.map((item) => (
            <details key={item.question} className={styles.item}>
              <summary className={styles.question}>
                {item.question}
                <LandingIcon name="plus" size={18} strokeWidth={2} className={styles.toggleIcon} />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
