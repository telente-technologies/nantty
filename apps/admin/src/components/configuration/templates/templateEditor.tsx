import { CheckboxField, TextAreaField, TextField } from "@/components/ui/formFields";
import type { NotificationTemplateContent } from "@/types/notificationTemplate.type";
import { findUnknownTemplateVariableNames, hasUnbalancedTemplateBraces, readCharacterLimitForChannel, renderTemplateWithSampleValues } from "@/utils/templateVariables.util";

import styles from "./templates.module.css";

export function findNotificationTemplateDraftProblem(template: NotificationTemplateContent): string | null {
  for (const text of [template.subject ?? "", template.body]) {
    if (hasUnbalancedTemplateBraces(text)) return "A {{ or }} is not closed properly.";
    const unknownNames = findUnknownTemplateVariableNames(text, template.variables);
    if (unknownNames.length > 0) return `Unknown variables: ${unknownNames.map((name) => `{{${name}}}`).join(", ")}. Use only the variables listed.`;
  }
  if (template.channel === "EMAIL" && (template.subject ?? "").trim().length < 3) return "Emails need a subject.";
  if (template.body.trim().length < 3) return "Write the message body.";
  if (template.body.length > readCharacterLimitForChannel(template.channel)) return `This channel allows ${readCharacterLimitForChannel(template.channel)} characters.`;
  return null;
}

export function TemplateEditor({ template, canWrite, onChange }: { readonly template: NotificationTemplateContent; readonly canWrite: boolean; readonly onChange: (updater: (current: NotificationTemplateContent) => NotificationTemplateContent) => void }) {
  const isDisabled = !canWrite;
  const characterLimit = readCharacterLimitForChannel(template.channel);
  const bodyUnknown = findUnknownTemplateVariableNames(template.body, template.variables);
  const subjectUnknown = findUnknownTemplateVariableNames(template.subject ?? "", template.variables);
  return (
    <div className={styles.editor}>
      <CheckboxField label="Send this template" description="When off, this event sends nothing on this channel in this language." checked={template.isEnabled} disabled={isDisabled} onChange={(event) => onChange((current) => ({ ...current, isEnabled: event.target.checked }))} />
      {template.channel === "EMAIL" ? (
        <TextField label="Subject" value={template.subject ?? ""} maxLength={150} disabled={isDisabled} error={subjectUnknown.length > 0 ? `Unknown: ${subjectUnknown.map((name) => `{{${name}}}`).join(", ")}` : null} onChange={(event) => onChange((current) => ({ ...current, subject: event.target.value }))} />
      ) : null}
      <TextAreaField
        label="Message"
        value={template.body}
        rows={template.channel === "EMAIL" ? 9 : 4}
        maxLength={characterLimit}
        disabled={isDisabled}
        hint={`${template.body.length} / ${characterLimit} characters`}
        error={bodyUnknown.length > 0 ? `Unknown: ${bodyUnknown.map((name) => `{{${name}}}`).join(", ")}` : null}
        onChange={(event) => onChange((current) => ({ ...current, body: event.target.value }))}
      />
      <div className={styles.variables}>
        <span className={styles.variablesLabel}>Variables you can use</span>
        {template.variables.map((variable) => (
          <button key={variable.name} type="button" className={styles.variableChip} disabled={isDisabled} title={`Example: ${variable.sampleValue}`} onClick={() => onChange((current) => ({ ...current, body: `${current.body}{{${variable.name}}}` }))}>
            {`{{${variable.name}}}`}
          </button>
        ))}
      </div>
      <section className={styles.preview} aria-label="Preview with sample data">
        <p className={styles.previewLabel}>Preview · {template.channel.replace("_", "-").toLowerCase()} · {template.locale}</p>
        {template.subject ? <p className={styles.previewSubject}>{renderTemplateWithSampleValues(template.subject, template.variables)}</p> : null}
        <p className={styles.previewBody}>{renderTemplateWithSampleValues(template.body, template.variables)}</p>
      </section>
    </div>
  );
}
