"use client";

import { useMutation } from "@tanstack/react-query";

import { chatReportsService } from "@/services/chatReports.service";

import type { ChatReportTarget } from "./chatReportTarget.type";
import styles from "./chatReport.module.css";

export function ChatReportDoneActions({ target, isUrgent }: { readonly target: ChatReportTarget; readonly isUrgent: boolean }) {
  const block = useMutation({ mutationFn: () => chatReportsService.blockConversationPeer(target.conversationId) });
  const restrict = useMutation({ mutationFn: () => chatReportsService.restrictConversationPeer(target.conversationId) });
  const isAboutPerson = !!target.reportedUser && target.kind !== "group";
  const alreadyBlocked = target.alsoBlock || block.isSuccess;
  return (
    <>
      <p>
        {isUrgent ? "Your report was marked urgent and goes to the front of the queue. " : ""}
        Our safety team will look at what you sent. The other person won't be told who reported them.
      </p>
      {isAboutPerson ? (
        <div className={styles.doneActions}>
          <button type="button" className={styles.doneAction} disabled={alreadyBlocked || block.isPending} onClick={() => block.mutate()}>
            <strong>{alreadyBlocked ? "Blocked" : "Block"}</strong>
            <span className={styles.mutedText}>They can't message you</span>
          </button>
          <button type="button" className={styles.doneAction} disabled={restrict.isSuccess || restrict.isPending} onClick={() => restrict.mutate()}>
            <strong>{restrict.isSuccess ? "Restricted" : "Restrict"}</strong>
            <span className={styles.mutedText}>Their messages go to Requests</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
