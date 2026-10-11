"use client";

import { useEffect, useState } from "react";

import { EmailPreviewFrame, EmailThemeToggle } from "@/components/emailTemplates/emailPreviewFrame";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { previewPolicyUpdatedEmail } from "@/services/emailTemplatesApi.service";
import type { EmailPreviewTheme, PolicyUpdatedPreviewInput } from "@/types/emailTemplates.type";
import type { LegalNoticeDraft } from "@/types/legal.type";

import styles from "./legal.module.css";

function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function LegalNoticeEmailFrame({ draft }: { readonly draft: LegalNoticeDraft }) {
  const [theme, setTheme] = useState<EmailPreviewTheme>("light");
  const input: PolicyUpdatedPreviewInput = {
    theme,
    documentTitle: draft.documentTitle,
    subject: draft.subject,
    summaryText: draft.summaryText,
    whatChanged: draft.whatChanged,
    effectiveAt: draft.effectiveAt,
    reacceptNote: draft.reacceptNote,
    documentUrl: draft.documentUrl,
  };
  const requestKey = useDebouncedValue(JSON.stringify(input), 400);
  const preview = useAdminQuery((signal) => previewPolicyUpdatedEmail(JSON.parse(requestKey) as PolicyUpdatedPreviewInput, signal), requestKey);
  return (
    <div className={styles.emailFrame} role="region" aria-label="Email preview">
      <EmailThemeToggle theme={theme} onChange={setTheme} />
      {preview.data ? <EmailPreviewFrame preview={preview.data} title="Policy update email preview" height={640} /> : null}
      {!preview.data && preview.isLoading ? <LoadingBlock label="Rendering the email" lines={6} /> : null}
      {preview.errorMessage ? <ErrorBlock error={preview.error} message={preview.errorMessage} onRetry={preview.reload} /> : null}
      <p className={styles.emailFrameNote}>Rendered with the policyUpdated template. Legal notices are sent even to people who opted out of marketing emails.</p>
    </div>
  );
}
