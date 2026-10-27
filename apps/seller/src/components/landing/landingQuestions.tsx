import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { contactEmailDisplayText, contactMailtoHref } from "@/config/siteMetadata.config";
import { landingQuestions } from "@/constants/landingContent.constant";

import styles from "./landingQuestions.module.css";

export function LandingQuestions() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-heading">
      <div className={styles.layout}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>FAQ</p>
          <h2 id="faq-heading" className={styles.heading}>
            Questions, answered.
          </h2>
          <p className={styles.contactNote}>
            Something else? Email <a href={contactMailtoHref}>{contactEmailDisplayText}</a>.
          </p>
        </div>
        <div className={styles.list}>
          {landingQuestions.map((item) => (
            <details key={item.question} className={styles.item}>
              <summary className={styles.question}>
                {item.question}
                <NanttyIcon name="plus16" size={18} className={styles.toggleIcon} />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
