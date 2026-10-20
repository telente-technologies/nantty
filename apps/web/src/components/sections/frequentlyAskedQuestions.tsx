import Link from "next/link";

import { contactEmailDisplayText, contactMailtoHref } from "@/lib/siteConfig.config";

import { FigmaIconTintedWithCurrentColor } from "../ui/figmaIcon";
import styles from "./frequentlyAskedQuestions.module.css";

export interface QuestionAndAnswer {
  readonly question: string;
  readonly answer: string;
}

interface FrequentlyAskedQuestionsProps {
  readonly questions: readonly QuestionAndAnswer[];
  readonly headingId?: string;
  readonly heading?: string;
  readonly sectionId?: string;
}

export function FrequentlyAskedQuestionsAccordion({ questions, headingId = "questions-heading", heading = "Questions, answered.", sectionId = "questions" }: FrequentlyAskedQuestionsProps) {
  return (
    <section id={sectionId} className={styles.section} aria-labelledby={headingId}>
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.intro}>
          <p className="eyebrowLabel">FAQ</p>
          <h2 id={headingId} className={styles.heading}>
            {heading}
          </h2>
          <p className={styles.contactNote}>
            Still unsure? <Link href="/contact">Talk to the team</Link> or email{" "}
            <a href={contactMailtoHref}>{contactEmailDisplayText}</a>.
          </p>
        </div>
        <div className={styles.list}>
          {questions.map((questionAndAnswer) => (
            <details key={questionAndAnswer.question} className={styles.item}>
              <summary className={styles.question}>
                {questionAndAnswer.question}
                <FigmaIconTintedWithCurrentColor name="plus16" size={18} className={styles.toggleIcon} />
              </summary>
              <p className={styles.answer}>{questionAndAnswer.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
