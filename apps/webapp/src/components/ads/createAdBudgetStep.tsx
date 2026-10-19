"use client";

import { useState } from "react";

import type { BoostEstimate, BoostOptions } from "@/types/boost.type";
import type { Money } from "@/types/money.type";
import { budgetFloorIssue, formatMinorAsMajorInput, parseMajorAmountToMinor, type AdDraft } from "@/utils/adsHub.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./adsHub.module.css";

const chipClass = (active: boolean) => [styles.chip, active ? styles.chipActive : ""].filter(Boolean).join(" ");
const DEFAULT_MAXIMUM_DURATION_DAYS = 30;
const DEFAULT_MAXIMUM_SCHEDULE_DAYS = 60;

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

interface CreateAdBudgetStepProps {
  readonly draft: AdDraft;
  readonly options: BoostOptions;
  readonly estimate: BoostEstimate | undefined;
  readonly estimateError: string | null;
  readonly onChange: (draft: AdDraft) => void;
}

export function CreateAdBudgetStep({ draft, options, estimate, estimateError, onChange }: CreateAdBudgetStepProps) {
  const currency = options.minimumDailyBudget.currency;
  const activeBudget = draft.budgetType === "daily" ? draft.dailyBudget : draft.totalBudget;
  const [amountText, setAmountText] = useState(formatMinorAsMajorInput(activeBudget));
  const maximumDays = options.maximumDurationDays ?? DEFAULT_MAXIMUM_DURATION_DAYS;
  const scheduleDays = options.maximumScheduleDays ?? DEFAULT_MAXIMUM_SCHEDULE_DAYS;
  const today = new Date();
  const latestStart = new Date(today.getTime() + scheduleDays * 86_400_000);
  const floorIssue = budgetFloorIssue(draft, options.minimumDailyBudget, (money) => formatMoneyForDisplay(money));

  const setBudgetAmount = (money: Money | null) => onChange(draft.budgetType === "daily" ? { ...draft, dailyBudget: money } : { ...draft, totalBudget: money });
  const changeAmountText = (text: string) => {
    setAmountText(text);
    const minor = parseMajorAmountToMinor(text);
    setBudgetAmount(minor === null ? null : { amountMinor: minor, currency });
  };
  const chooseSuggested = (money: Money) => {
    setAmountText(formatMinorAsMajorInput(money));
    setBudgetAmount(money);
  };
  const switchBudgetType = (budgetType: AdDraft["budgetType"]) => {
    const next = budgetType === "daily" ? draft.dailyBudget : draft.totalBudget;
    setAmountText(formatMinorAsMajorInput(next));
    onChange({ ...draft, budgetType });
  };
  const suggestions = draft.budgetType === "daily" ? options.suggestedDailyBudgets : options.suggestedDailyBudgets.map((daily) => ({ amountMinor: daily.amountMinor * draft.durationDays, currency: daily.currency }));

  return (
    <section className={styles.section} aria-label="Budget and schedule">
      <h2 className={styles.sectionTitle}>Budget and schedule</h2>
      <div className={styles.chips} role="radiogroup" aria-label="Budget type">
        <button type="button" role="radio" aria-checked={draft.budgetType === "daily"} className={chipClass(draft.budgetType === "daily")} onClick={() => switchBudgetType("daily")}>Daily budget</button>
        <button type="button" role="radio" aria-checked={draft.budgetType === "total"} className={chipClass(draft.budgetType === "total")} onClick={() => switchBudgetType("total")}>Total budget</button>
      </div>
      <label className={styles.field}>
        {draft.budgetType === "daily" ? `Daily budget (${currency})` : `Total budget (${currency})`}
        <input className={styles.input} inputMode="decimal" value={amountText} onChange={(event) => changeAmountText(event.target.value)} aria-describedby="ad-budget-floor" aria-invalid={Boolean(floorIssue) || undefined} />
      </label>
      <div className={styles.chips} role="group" aria-label="Suggested budgets">
        {suggestions.map((money) => (
          <button key={money.amountMinor} type="button" className={chipClass(activeBudget?.amountMinor === money.amountMinor)} aria-pressed={activeBudget?.amountMinor === money.amountMinor} onClick={() => chooseSuggested(money)}>{formatMoneyForDisplay(money, { showDecimals: false })}</button>
        ))}
      </div>
      <p id="ad-budget-floor" className={floorIssue ? styles.error : styles.note}>{floorIssue ?? `Minimum ${formatMoneyForDisplay(options.minimumDailyBudget)} a day.`}</p>
      <div className={styles.inlineFields}>
        <label className={styles.field}>
          Number of days
          <input className={styles.input} type="number" inputMode="numeric" min={1} max={maximumDays} value={draft.durationDays} onChange={(event) => onChange({ ...draft, durationDays: Math.min(maximumDays, Math.max(1, Math.round(Number(event.target.value) || 1))) })} />
        </label>
        <label className={styles.field}>
          Start date (optional)
          <input className={styles.input} type="date" min={isoDate(today)} max={isoDate(latestStart)} value={draft.startDate ?? ""} onChange={(event) => onChange({ ...draft, startDate: event.target.value || null })} />
        </label>
      </div>
      <div className={styles.chips} role="group" aria-label="Quick durations">
        {options.durationDayOptions.map((days) => (
          <button key={days} type="button" className={chipClass(draft.durationDays === days)} aria-pressed={draft.durationDays === days} onClick={() => onChange({ ...draft, durationDays: days })}>{days} {days === 1 ? "day" : "days"}</button>
        ))}
      </div>
      <p className={styles.note}>{draft.startDate ? "Your ad starts on this date if it's approved by then." : "Your ad starts as soon as it's approved."}</p>
      <div className={styles.card} aria-live="polite">
        <span className={styles.label}>Total cost</span>
        <span className={styles.metricValue}>{estimate ? formatMoneyForDisplay(estimate.totalCost) : "—"}</span>
        {estimate ? <span className={styles.rowMeta}>{estimate.estimatedReachMin.toLocaleString()}–{estimate.estimatedReachMax.toLocaleString()} people · {estimate.estimatedResultsLabel}</span> : null}
        {estimateError ? <span className={styles.error} role="alert">{estimateError}</span> : null}
      </div>
    </section>
  );
}
