import type { ChatReportReason } from "@/types";

import {
  CHAT_REPORT_REASON_OPTIONS,
  CHILD_SAFETY_PRIORITY_NOTICE,
  MAXIMUM_CHAT_REPORT_DETAILS_LENGTH,
  SELF_HARM_SUPPORT_NOTICE,
} from "./chatReportReasons.constant";
import styles from "./chatReport.module.css";

interface ChatReportReasonFieldsProps {
  readonly reason: ChatReportReason | null;
  readonly details: string;
  readonly onChangeReason: (reason: ChatReportReason) => void;
  readonly onChangeDetails: (details: string) => void;
}

export function ChatReportReasonFields({ reason, details, onChangeReason, onChangeDetails }: ChatReportReasonFieldsProps) {
  return (
    <>
      <fieldset className={styles.optionList}>
        <legend className="visuallyHidden">Why are you reporting this?</legend>
        {CHAT_REPORT_REASON_OPTIONS.map((option) => (
          <label key={option.reason} className={styles.option}>
            <input type="radio" name="chat-report-reason" checked={reason === option.reason} onChange={() => onChangeReason(option.reason)} />
            <span className={styles.optionTitle}>{option.label}</span>
            {option.isUrgent ? <span className={styles.urgentTag}>Urgent</span> : null}
          </label>
        ))}
      </fieldset>
      {reason === "self_harm" ? <p className={styles.notice} role="status">{SELF_HARM_SUPPORT_NOTICE}</p> : null}
      {reason === "child_safety" ? <p className={styles.notice} role="status">{CHILD_SAFETY_PRIORITY_NOTICE}</p> : null}
      <label className={styles.label} htmlFor="chat-report-details">
        {reason === "other" ? "Tell us what happened (required)" : "Anything else we should know? (optional)"}
      </label>
      <textarea
        id="chat-report-details"
        className={styles.textarea}
        maxLength={MAXIMUM_CHAT_REPORT_DETAILS_LENGTH}
        value={details}
        onChange={(event) => onChangeDetails(event.target.value)}
      />
    </>
  );
}
