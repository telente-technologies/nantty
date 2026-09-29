import type { ReactNode } from "react";

import styles from "./sectionIntro.module.css";

interface SectionIntroProps {
  readonly eyebrow: string;
  readonly headingId: string;
  readonly heading: ReactNode;
  readonly description?: ReactNode;
  readonly tone?: "light" | "dark";
  readonly align?: "start" | "center";
}

export function SectionIntroWithEyebrowAndHeading({ eyebrow, headingId, heading, description, tone = "light", align = "start" }: SectionIntroProps) {
  return (
    <div className={`${styles.intro} ${styles[tone]} ${styles[align]}`}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={headingId} className={styles.heading}>
        {heading}
      </h2>
      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}
