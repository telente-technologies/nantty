"use client";

import { useState, type FormEvent } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { MoneyField, SelectField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PayoutSchedule, PayoutScheduleMode } from "@/types/finance.type";
import type { CursorPage } from "@/types/pagination.type";
import type { PayoutAccount } from "@/types/wallet.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { convertMinorUnitsToMajorInputText } from "@/utils/money.util";

import styles from "./wallet.module.css";

const scheduleModeOptions: { value: PayoutScheduleMode; label: string }[] = [
  { value: "manual", label: "Only when I withdraw" },
  { value: "daily", label: "Every working day" },
  { value: "weekly", label: "Once a week" },
  { value: "monthly", label: "Once a month" },
];

const weekdayOptions = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, index) => ({ value: String(index), label }));
const dayOfMonthOptions = Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));

function PayoutScheduleFormFields({ schedule, accounts, onSaved }: { readonly schedule: PayoutSchedule; readonly accounts: readonly PayoutAccount[]; readonly onSaved: (schedule: PayoutSchedule) => void }) {
  const { can } = useSellerSession();
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const [mode, setMode] = useState<PayoutScheduleMode>(schedule.mode);
  const [weekday, setWeekday] = useState(String(schedule.weekday));
  const [dayOfMonth, setDayOfMonth] = useState(String(schedule.dayOfMonth));
  const [accountId, setAccountId] = useState(schedule.accountId ?? accounts[0]?.id ?? "");
  const [keepText, setKeepText] = useState(convertMinorUnitsToMajorInputText(schedule.keepMinimumBalance.amountMinor, schedule.keepMinimumBalance.currency));
  const [keepMinor, setKeepMinor] = useState<number | null>(schedule.keepMinimumBalance.amountMinor);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const canEdit = can("wallet:withdraw");

  async function savePayoutSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (keepMinor === null) {
      setFieldErrors({ keepMinimumBalanceMinor: "Enter an amount of zero or more." });
      return;
    }
    setIsSaving(true);
    setFieldErrors({});
    try {
      const saved = await sendSellerApiRequest<PayoutSchedule>("/seller/wallet/payouts/schedule", { method: "PUT", body: { mode, weekday: Number(weekday), dayOfMonth: Number(dayOfMonth), keepMinimumBalanceMinor: keepMinor, accountId: mode === "manual" ? null : accountId } });
      onSaved(saved);
      showToast(saved.mode === "manual" ? "Automatic payouts are off." : `Automatic payouts saved. Next one ${formatDateTimeForDisplay(saved.nextRunAt)}.`);
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues && error.issues.length > 0) setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
      else showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void savePayoutSchedule(event)} noValidate className={styles.stack}>
      {!canEdit ? <Callout tone="info">Only the store owner can change automatic payouts.</Callout> : null}
      <div className={styles.formGrid}>
        <SelectField label="Send money to my bank" value={mode} disabled={!canEdit} onChange={(event) => setMode(event.target.value as PayoutScheduleMode)} options={scheduleModeOptions} errorMessage={fieldErrors.mode} />
        {mode === "weekly" ? <SelectField label="Day of the week" value={weekday} disabled={!canEdit} onChange={(event) => setWeekday(event.target.value)} options={weekdayOptions} errorMessage={fieldErrors.weekday} /> : null}
        {mode === "monthly" ? <SelectField label="Day of the month" value={dayOfMonth} disabled={!canEdit} onChange={(event) => setDayOfMonth(event.target.value)} options={dayOfMonthOptions} errorMessage={fieldErrors.dayOfMonth} /> : null}
        {mode !== "manual" ? (
          <SelectField label="Payout account" value={accountId} disabled={!canEdit || accounts.length === 0} onChange={(event) => setAccountId(event.target.value)} options={accounts.map((account) => ({ value: account.id, label: `${account.bankName} ${account.accountNumberMasked}` }))} errorMessage={fieldErrors.accountId ?? (accounts.length === 0 ? "Add a payout account first." : undefined)} />
        ) : null}
        {mode !== "manual" ? (
          <MoneyField label="Always keep in wallet" currency={schedule.keepMinimumBalance.currency} valueText={keepText} onValueTextChange={setKeepText} onMinorAmountChange={setKeepMinor} disabled={!canEdit} errorMessage={fieldErrors.keepMinimumBalanceMinor} hint="We pay out everything above this amount, minus the provider's fee." />
        ) : null}
      </div>
      {schedule.mode !== "manual" && schedule.nextRunAt ? <p className={styles.muted}>Next automatic payout: {formatDateTimeForDisplay(schedule.nextRunAt)} · keeping {formatMoney(schedule.keepMinimumBalance)}</p> : null}
      {canEdit ? (
        <div className={styles.formActions}>
          <Button type="submit" variant="primary" isBusy={isSaving}>
            Save payout preferences
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function PayoutScheduleForm() {
  const scheduleQuery = useSellerQuery<PayoutSchedule>("/seller/wallet/payouts/schedule");
  const accountsQuery = useSellerQuery<CursorPage<PayoutAccount>>("/seller/wallet/payout-accounts");
  const schedule = scheduleQuery.data;
  return (
    <Panel title="Withdrawal preferences" description="Withdraw by hand whenever you like, or let Zudomart send your available balance to your bank on a schedule.">
      {scheduleQuery.errorMessage ? <ErrorCallout error={scheduleQuery.error} message={scheduleQuery.errorMessage} onRetry={scheduleQuery.reload} /> : null}
      {schedule && accountsQuery.data ? (
        <PayoutScheduleFormFields key={`${schedule.mode}-${schedule.nextRunAt ?? ""}`} schedule={schedule} accounts={accountsQuery.data.data} onSaved={(saved) => scheduleQuery.replaceData(() => saved)} />
      ) : !scheduleQuery.errorMessage ? (
        <LoadingBlock label="Loading payout preferences" />
      ) : null}
    </Panel>
  );
}
