"use client";

import { useMemo, useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/formFields";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Toolbar } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchVersionedRecords, notificationTemplatesEndpoint } from "@/services/configurationApi.service";
import type { NotificationTemplateContent } from "@/types/notificationTemplate.type";
import type { VersionedRecord } from "@/types/platformConfiguration.type";

import { VersionedRecordPanel } from "../shared/versionedRecordPanel";
import { findNotificationTemplateDraftProblem, TemplateEditor } from "./templateEditor";
import styles from "./templates.module.css";

type TemplateRecord = VersionedRecord<NotificationTemplateContent>;

const supportedLocales = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "pcm", label: "Naija Pidgin" },
] as const;
const channelLabels: Record<string, string> = { PUSH: "Push", EMAIL: "Email", SMS: "SMS", IN_APP: "In-app" };

function buildTemplateIdentifier(template: NotificationTemplateContent): string {
  return `${template.event}.${template.channel.toLowerCase()}.${template.locale}`;
}

export function TemplatesWorkspace() {
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const canWrite = can("templates:manage");
  const templates = useAdminQuery((signal) => fetchVersionedRecords(notificationTemplatesEndpoint, signal), "notification-templates");
  const [eventFilter, setEventFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [openTemplate, setOpenTemplate] = useState<TemplateRecord | { newFrom: NotificationTemplateContent } | null>(null);
  const [translationLocale, setTranslationLocale] = useState<string>("fr");

  const allTemplates = templates.data?.items ?? [];
  const events = useMemo(() => [...new Set(allTemplates.map((template) => template.content.event))].sort(), [allTemplates]);
  const visibleTemplates = allTemplates.filter((template) => (!eventFilter || template.content.event === eventFilter) && (!channelFilter || template.content.channel === channelFilter));
  const isNew = openTemplate !== null && "newFrom" in openTemplate;
  const openRecord = openTemplate && !("newFrom" in openTemplate) ? openTemplate : null;

  function startTranslation(source: TemplateRecord) {
    setOpenTemplate({ newFrom: { ...source.content, locale: translationLocale, isEnabled: false } });
  }

  const translationTarget = openRecord ? allTemplates.some((template) => template.id === buildTemplateIdentifier({ ...openRecord.content, locale: translationLocale })) : true;

  return (
    <>
      <PageHeader area="Configuration" title="Notification templates" description="Messages people receive for each event, per channel and language. Variables like {{displayName}} are filled in when sent; unknown variables are rejected." />
      <Toolbar>
        <SelectField label="Event" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} options={[{ value: "", label: "All events" }, ...events.map((event) => ({ value: event, label: event }))]} />
        <SelectField label="Channel" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)} options={[{ value: "", label: "All channels" }, ...Object.entries(channelLabels).map(([value, label]) => ({ value, label }))]} />
      </Toolbar>
      {templates.errorMessage ? <ErrorBlock message={templates.errorMessage} onRetry={templates.reload} /> : null}
      <DataTable<TemplateRecord>
        caption="Notification templates"
        rows={visibleTemplates}
        isLoading={templates.isLoading}
        readRowKey={(template) => template.id}
        onRowOpen={(template) => setOpenTemplate(template)}
        selectedRowKey={openRecord?.id ?? null}
        columns={[
          { key: "event", header: "Event", isMono: true, render: (template) => template.content.event },
          { key: "channel", header: "Channel", width: "90px", render: (template) => channelLabels[template.content.channel] ?? template.content.channel },
          { key: "locale", header: "Language", width: "110px", render: (template) => supportedLocales.find((locale) => locale.value === template.content.locale)?.label ?? template.content.locale },
          { key: "text", header: "Message", render: (template) => <span className={styles.snippet}>{template.content.subject ?? template.content.body}</span> },
          { key: "status", header: "Status", width: "90px", render: (template) => <StatusBadge label={template.content.isEnabled ? "Sending" : "Off"} tone={template.content.isEnabled ? "success" : "neutral"} /> },
          { key: "version", header: "Version", width: "70px", isMono: true, render: (template) => `v${template.version}` },
        ]}
      />
      {openTemplate ? (
        <VersionedRecordPanel<NotificationTemplateContent>
          key={isNew ? `new-${buildTemplateIdentifier((openTemplate as { newFrom: NotificationTemplateContent }).newFrom)}` : `${openRecord!.id}@${openRecord!.version}`}
          endpoint={notificationTemplatesEndpoint}
          record={openRecord}
          blankContent={isNew ? (openTemplate as { newFrom: NotificationTemplateContent }).newFrom : openRecord!.content}
          title={isNew ? "Template translation" : `Template ${openRecord!.id}`}
          canWrite={canWrite}
          deriveNewRecordId={buildTemplateIdentifier}
          findDraftProblem={findNotificationTemplateDraftProblem}
          renderEditor={(content, updateContent, isWritable) => (
            <>
              <TemplateEditor template={content} canWrite={isWritable} onChange={updateContent} />
              {openRecord && canWrite ? (
                <div className={styles.translate}>
                  <SelectField label="Translate into" value={translationLocale} onChange={(event) => setTranslationLocale(event.target.value)} options={supportedLocales.filter((locale) => locale.value !== openRecord.content.locale).map((locale) => ({ value: locale.value, label: locale.label }))} />
                  <Button size="small" iconName="plus16" disabled={translationTarget} onClick={() => startTranslation(openRecord)}>
                    {translationTarget ? "Translation exists" : "Start translation"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
          onChanged={(record, verb) => {
            templates.reload();
            setOpenTemplate(record);
            showToast(`Template ${record.id} ${verb} (v${record.version}).`);
          }}
          onClose={() => setOpenTemplate(null)}
        />
      ) : null}
    </>
  );
}
