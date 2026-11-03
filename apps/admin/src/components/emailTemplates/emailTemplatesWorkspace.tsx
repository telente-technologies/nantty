"use client";

import { useMemo, useState } from "react";

import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge, type BadgeTone } from "@/components/ui/statusBadge";
import { Card } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchEmailTemplateCatalogue, fetchEmailTemplatePreview } from "@/services/emailTemplatesApi.service";
import type { EmailPreviewTheme, EmailTemplateKind, EmailTemplateSummary } from "@/types/emailTemplates.type";

import { EmailPreviewFrame, EmailThemeToggle } from "./emailPreviewFrame";
import styles from "./emailTemplates.module.css";

const kindTones: Record<EmailTemplateKind, BadgeTone> = { transactional: "neutral", security: "caution", legal: "night", marketing: "brand" };

function TemplatePreview({ template, theme }: { readonly template: EmailTemplateSummary; readonly theme: EmailPreviewTheme }) {
  const preview = useAdminQuery((signal) => fetchEmailTemplatePreview(template.key, theme, signal), `${template.key}:${theme}`);
  const [isTextShown, setIsTextShown] = useState(false);
  if (preview.isLoading) return <LoadingBlock label="Rendering the email" lines={8} />;
  if (preview.errorMessage || !preview.data) return <ErrorBlock variant="section" error={preview.error} message={preview.errorMessage ?? "The preview didn't render."} onRetry={preview.reload} />;
  return (
    <div className={styles.previewColumn}>
      <dl className={styles.facts}>
        <dt>Trigger</dt>
        <dd><code>{template.trigger}</code></dd>
        <dt>Audience</dt>
        <dd>{template.audience}</dd>
        <dt>Consent</dt>
        <dd>{template.consent}</dd>
      </dl>
      <button type="button" className={styles.textToggle} onClick={() => setIsTextShown((value) => !value)} aria-expanded={isTextShown}>
        {isTextShown ? "Show HTML version" : "Show plain-text version"}
      </button>
      {isTextShown ? <pre className={styles.plainText}>{preview.data.text}</pre> : <EmailPreviewFrame preview={preview.data} title={`${template.name} email preview`} />}
    </div>
  );
}

export function EmailTemplatesWorkspace() {
  const catalogue = useAdminQuery((signal) => fetchEmailTemplateCatalogue(signal), "email-templates");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [theme, setTheme] = useState<EmailPreviewTheme>("light");
  const items = useMemo(() => catalogue.data?.items ?? [], [catalogue.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => `${item.name} ${item.key} ${item.category} ${item.trigger}`.toLowerCase().includes(term)) : items;
  }, [items, search]);
  const groups = useMemo(() => [...new Set(filtered.map((item) => item.category))].map((category) => ({ category, items: filtered.filter((item) => item.category === category) })), [filtered]);
  const selected = items.find((item) => item.key === selectedKey) ?? filtered[0] ?? null;

  return (
    <>
      <PageHeader
        area="Support"
        title="Email template library"
        description="Registered templates rendered with sample data. This library includes event-driven, scheduled and campaign templates; listing a template here does not mean its producer is active. Marketing emails carry an unsubscribe link; other templates follow their category's preference rules."
        meta={catalogue.data ? <span>{items.length} templates · {items.filter((item) => item.kind === "marketing").length} marketing</span> : null}
        actions={<EmailThemeToggle theme={theme} onChange={setTheme} />}
      />
      {catalogue.isLoading ? <LoadingBlock label="Loading templates" /> : null}
      {catalogue.errorMessage ? <ErrorBlock error={catalogue.error} message={catalogue.errorMessage} onRetry={catalogue.reload} /> : null}
      {catalogue.data ? (
        <div className={styles.layout}>
          <Card isFlush className={styles.listCard}>
            <div className={styles.searchRow}>
              <TextField label="Search templates" isLabelHidden placeholder="Search by name, key or event" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <nav aria-label="Email templates" className={styles.list}>
              {groups.map((group) => (
                <section key={group.category}>
                  <h2 className={styles.groupTitle}>{group.category}</h2>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.key}>
                        <button type="button" className={styles.listItem} aria-current={selected?.key === item.key ? "true" : undefined} onClick={() => setSelectedKey(item.key)}>
                          <span className={styles.listName}>{item.name}</span>
                          <StatusBadge label={item.kind} tone={kindTones[item.kind]} hasDot={false} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {groups.length === 0 ? <p className={styles.empty}>No template matches “{search}”.</p> : null}
            </nav>
          </Card>
          <Card title={selected ? <span>{selected.name} <code className={styles.keyCode}>{selected.key}</code></span> : "Preview"}>
            {selected ? <TemplatePreview key={selected.key} template={selected} theme={theme} /> : <p className={styles.empty}>Choose a template.</p>}
          </Card>
        </div>
      ) : null}
    </>
  );
}
