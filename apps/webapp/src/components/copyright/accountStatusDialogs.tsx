"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modalDialog";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { isValidContactEmail } from "@/services/copyrightAccount.service";
import type { AccountStrike, CopyrightNotice, ModerationDecision } from "@/types";

import styles from "./copyright.module.css";
import { useAccountHealthActions } from "./accountHealth.hook";
import { COUNTER_NOTICE_DECLARATION } from "./copyrightLegal.constant";

export function AppealDecisionDialog({ decision, onClose }: { readonly decision: ModerationDecision | null; readonly onClose: () => void }) {
  const [message, setMessage] = useState("");
  const { appealDecision } = useAccountHealthActions();
  const send = () =>
    decision &&
    appealDecision.mutate(
      { reportId: decision.reportId, message: message.trim() },
      { onSuccess: () => { showToast({ text: "Appeal sent. A different reviewer will look at it." }); setMessage(""); onClose(); } },
    );
  return (
    <ModalDialog isOpen={!!decision} onClose={onClose} title="Appeal moderation decision" description={decision?.reason} intent="dispute"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={send} disabled={message.trim().length < 20} busy={appealDecision.isPending}>Send appeal</Button></>}>
      <label className={styles.field}>Why should we reverse this decision?<span className={styles.hint}>At least 20 characters.</span>
        <textarea className={styles.input} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} />
      </label>
      {appealDecision.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(appealDecision.error)}</p> : null}
    </ModalDialog>
  );
}

export function AppealStrikeDialog({ strike, onClose }: { readonly strike: AccountStrike | null; readonly onClose: () => void }) {
  const [message, setMessage] = useState("");
  const { appeal } = useAccountHealthActions();
  const send = () => strike && appeal.mutate({ strikeId: strike.id, message: message.trim() }, { onSuccess: () => { showToast({ text: "Appeal sent. A different reviewer will look at it." }); setMessage(""); onClose(); } });
  return (
    <ModalDialog isOpen={!!strike} onClose={onClose} title={`Appeal this ${strike?.kind === "WARNING" ? "warning" : "strike"}`} description={strike?.reason} intent="dispute"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={send} disabled={message.trim().length < 20} busy={appeal.isPending}>Send appeal</Button></>}>
      <label className={styles.field}>Why should we remove it?<span className={styles.hint}>At least 20 characters.</span>
        <textarea className={styles.input} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} />
      </label>
      {appeal.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(appeal.error)}</p> : null}
    </ModalDialog>
  );
}

export function CounterNoticeDialog({ notice, onClose }: { readonly notice: CopyrightNotice | null; readonly onClose: () => void }) {
  const [statement, setStatement] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [declared, setDeclared] = useState(false);
  const { counterNotice } = useAccountHealthActions();
  const canSend = statement.trim().length >= 20 && isValidContactEmail(contactEmail) && declared;
  const send = () =>
    notice && counterNotice.mutate({ claimId: notice.claimId, input: { statement: statement.trim(), contactEmail: contactEmail.trim(), goodFaith: true } }, {
      onSuccess: () => { showToast({ text: "Counter-notice sent. We'll email you about next steps." }); setStatement(""); setDeclared(false); onClose(); },
    });
  return (
    <ModalDialog isOpen={!!notice} onClose={onClose} title="Send a counter-notice" description={notice ? `For ${notice.workTitle}. If accepted and the claimant doesn't start court action, your content is restored after 10 business days.` : undefined} intent="copyright"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={send} disabled={!canSend} busy={counterNotice.isPending}>Send counter-notice</Button></>}>
      <div className={styles.form}>
        <label className={styles.field}>Your statement<span className={styles.hint}>Explain why you have the right to use this work.</span>
          <textarea className={styles.input} value={statement} maxLength={2000} onChange={(event) => setStatement(event.target.value)} />
        </label>
        <label className={styles.field}>Contact email
          <input className={styles.input} type="email" value={contactEmail} maxLength={254} autoComplete="email" onChange={(event) => setContactEmail(event.target.value)} />
        </label>
        <label className={styles.checkbox}><input type="checkbox" checked={declared} onChange={(event) => setDeclared(event.target.checked)} /> {COUNTER_NOTICE_DECLARATION}</label>
        {counterNotice.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(counterNotice.error)}</p> : null}
      </div>
    </ModalDialog>
  );
}
