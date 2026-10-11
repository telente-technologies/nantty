"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useToast } from "@/components/ui/toastProvider";
import { breakdownOptions, metricDefinitions } from "@/constants/reportOptions.constant";
import { AdsApiRequestError, readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import { reportsApi } from "@/services/reportsApi.service";
import type { MetricKey, ReportBreakdown, ReportFrequency, ScheduledReport } from "@/types/report.type";
import { isValidEmailAddress } from "@/utils/formValidation.util";

import styles from "./reportsPage.module.css";

interface ScheduleReportDialogProps {
  readonly accountId: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreated: (report: ScheduledReport) => void;
  readonly initialBreakdown: ReportBreakdown;
  readonly initialMetrics: readonly MetricKey[];
  readonly defaultRecipient: string | null;
}

const frequencyOptions: { value: ReportFrequency; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every Monday" },
  { value: "monthly", label: "First day of each month" },
];

export function ScheduleReportDialog(props: ScheduleReportDialogProps) {
  const { showToast } = useToast();
  const [name, setName] = useState("Weekly performance");
  const [recipientsText, setRecipientsText] = useState(props.defaultRecipient ?? "");
  const [frequency, setFrequency] = useState<ReportFrequency>("weekly");
  const [breakdown, setBreakdown] = useState<ReportBreakdown>(props.initialBreakdown);
  const [metrics, setMetrics] = useState<MetricKey[]>([...props.initialMetrics]);
  const [errors, setErrors] = useState<{ name?: string; recipients?: string; metrics?: string; form?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  async function saveScheduledReport() {
    const recipients = recipientsText.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean);
    const nextErrors = {
      name: name.trim().length === 0 ? "Name this report." : undefined,
      recipients: recipients.length === 0 || recipients.length > 10 || !recipients.every(isValidEmailAddress) ? "Add 1 to 10 valid email addresses, separated by commas." : undefined,
      metrics: metrics.length === 0 ? "Choose at least one metric." : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.recipients || nextErrors.metrics) return;
    setIsSaving(true);
    try {
      const created = await reportsApi.createScheduledReport(props.accountId, { name: name.trim(), recipients, frequency, breakdown, metrics });
      showToast("Scheduled report saved");
      props.onCreated(created);
      props.onClose();
    } catch (error) {
      setErrors({ form: error instanceof AdsApiRequestError && error.issues[0] ? error.issues[0].message : readErrorMessageForDisplay(error) });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OverlayDialog intent="schedule"
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Schedule an email report"
      description="We email a CSV of the previous period to everyone on the list."
      footer={
        <>
          <Button onClick={props.onClose}>Cancel</Button>
          <Button variant="primary" isLoading={isSaving} onClick={saveScheduledReport}>
            Save schedule
          </Button>
        </>
      }
    >
      {errors.form ? <p className={styles.formError} role="alert">{errors.form}</p> : null}
      <TextField label="Report name" value={name} onValueChange={setName} maxLength={100} error={errors.name} />
      <TextField label="Send to" value={recipientsText} onValueChange={setRecipientsText} placeholder="name@business.ng, finance@business.ng" hint="Up to 10 addresses, separated by commas." error={errors.recipients} />
      <div className={styles.dialogRow}>
        <SelectField label="How often" value={frequency} onValueChange={setFrequency} options={frequencyOptions} />
        <SelectField label="Break down by" value={breakdown} onValueChange={setBreakdown} options={breakdownOptions.map((option) => ({ value: option.breakdown, label: option.label }))} />
      </div>
      <fieldset className={styles.metricFieldset}>
        <legend>Metrics</legend>
        <div className={styles.metricChecklist}>
          {metricDefinitions.map((definition) => (
            <CheckboxField key={definition.key} label={definition.label} checked={metrics.includes(definition.key)} onCheckedChange={(checked) => setMetrics((current) => (checked ? [...current, definition.key] : current.filter((key) => key !== definition.key)))} />
          ))}
        </div>
        {errors.metrics ? <p className={styles.formError} role="alert">{errors.metrics}</p> : null}
      </fieldset>
    </OverlayDialog>
  );
}
