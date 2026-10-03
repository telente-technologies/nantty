import { useMemo } from "react";

import { buildSideBySideLineDiff } from "@/utils/legalLineDiff.util";

import styles from "./legal.module.css";

interface LegalVersionDiffProps {
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly leftMarkdown: string;
  readonly rightMarkdown: string;
}

export function LegalVersionDiff({ leftLabel, rightLabel, leftMarkdown, rightMarkdown }: LegalVersionDiffProps) {
  const rows = useMemo(() => buildSideBySideLineDiff(leftMarkdown, rightMarkdown), [leftMarkdown, rightMarkdown]);
  const changedRowCount = rows.filter((row) => row.kind !== "same").length;
  return (
    <div className={styles.stack}>
      <p className={styles.muted}>{changedRowCount === 0 ? "These two versions have identical text." : `${changedRowCount} changed line${changedRowCount === 1 ? "" : "s"}.`}</p>
      <table className={styles.sideBySide}>
        <caption className="visuallyHidden">{`${leftLabel} compared with ${rightLabel}`}</caption>
        <thead>
          <tr><th scope="col">{leftLabel}</th><th scope="col">{rightLabel}</th></tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td className={row.leftText === null ? styles.empty : row.kind === "same" ? undefined : styles.removed}>{row.leftText}</td>
              <td className={row.rightText === null ? styles.empty : row.kind === "same" ? undefined : styles.added}>{row.rightText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
