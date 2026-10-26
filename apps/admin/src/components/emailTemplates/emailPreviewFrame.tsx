"use client";

import { SegmentedTabs } from "@/components/ui/tabs";
import type { EmailPreviewTheme, RenderedEmailPreview } from "@/types/emailTemplates.type";

import styles from "./emailTemplates.module.css";

const themeTabs = [
  { key: "light" as const, label: "Light" },
  { key: "dark" as const, label: "Dark" },
];

export function EmailThemeToggle({ theme, onChange }: { readonly theme: EmailPreviewTheme; readonly onChange: (theme: EmailPreviewTheme) => void }) {
  return <SegmentedTabs items={themeTabs} activeKey={theme} onChange={onChange} label="Preview theme" />;
}

export function EmailPreviewFrame({ preview, title, height = 720 }: { readonly preview: RenderedEmailPreview; readonly title: string; readonly height?: number }) {
  return (
    <div className={styles.frameShell}>
      <div className={styles.inboxBar}>
        <span className={styles.inboxFrom}>Nantty</span>
        <span className={styles.inboxSubject}>{preview.subject}</span>
      </div>
      <iframe className={styles.frame} title={title} srcDoc={preview.html} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" style={{ height }} />
    </div>
  );
}
