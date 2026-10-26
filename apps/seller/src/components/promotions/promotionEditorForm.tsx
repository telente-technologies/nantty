"use client";

import { useState, type FormEvent } from "react";

import { convertIsoToLocalDateTimeInputValue, convertLocalDateTimeInputValueToIso, describePromotionDiscount, promotionKindLabel } from "@/components/promotions/promotionPresentation.util";
import { PromotionScopePicker, type PromotionScopeValue } from "@/components/promotions/promotionScopePicker";
import { Button } from "@/components/ui/button";
import { FormErrorSummary, MoneyField, SelectField, TextField } from "@/components/ui/formFields";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { Panel } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { CurrencyCode } from "@/types/money.type";
import type { Promotion } from "@/types/promotion.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";
import { validatePromotionInput, type PromotionInput } from "@/utils/promotionValidation.util";

import styles from "./promotions.module.css";

function convertOptionalWholeNumberText(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return /^\d{1,8}$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function convertPercentTextToBasisPoints(text: string): number {
  return /^\d{1,3}(\.\d{1,2})?$/.test(text.trim()) ? Math.round(Number(text.trim()) * 100) : Number.NaN;
}

export function PromotionEditorForm({ promotion, currency, isSaving, onSubmit }: { readonly promotion: Promotion | null; readonly currency: CurrencyCode; readonly isSaving: boolean; readonly onSubmit: (input: PromotionInput) => void }) {
  const { formatMoney } = useMoneyFormatter();
  const [name, setName] = useState(promotion?.name ?? "");
  const [kind, setKind] = useState<Promotion["kind"]>(promotion?.kind ?? "coupon");
  const [code, setCode] = useState(promotion?.code ?? "");
  const [discountKind, setDiscountKind] = useState<"percent" | "amount">(promotion?.discount.kind ?? "percent");
  const [percentText, setPercentText] = useState(promotion?.discount.kind === "percent" ? String(promotion.discount.value / 100) : "10");
  const [amountText, setAmountText] = useState(promotion?.discount.kind === "amount" ? convertMinorUnitsToMajorInputText(promotion.discount.value, currency) : "");
  const [scope, setScope] = useState<PromotionScopeValue>(promotion?.scope ?? { kind: "all", ids: [] });
  const [minimumSpendText, setMinimumSpendText] = useState(promotion?.minimumSpend ? convertMinorUnitsToMajorInputText(promotion.minimumSpend.amountMinor, currency) : "");
  const [usageLimitText, setUsageLimitText] = useState(promotion?.usageLimit ? String(promotion.usageLimit) : "");
  const [perCustomerText, setPerCustomerText] = useState(promotion?.usageLimitPerCustomer ? String(promotion.usageLimitPerCustomer) : "");
  const [startsLocal, setStartsLocal] = useState(convertIsoToLocalDateTimeInputValue(promotion?.startsAt ?? new Date().toISOString()));
  const [endsLocal, setEndsLocal] = useState(convertIsoToLocalDateTimeInputValue(promotion?.endsAt ?? null));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function buildPromotionInputFromForm(): PromotionInput {
    const minimumSpendMinor = minimumSpendText.trim() === "" ? null : convertMajorInputToMinorUnits(minimumSpendText, currency) ?? Number.NaN;
    return {
      name: name.trim(),
      kind,
      code: kind === "coupon" ? code.trim().toUpperCase() : null,
      discount: { kind: discountKind, value: discountKind === "percent" ? convertPercentTextToBasisPoints(percentText) : convertMajorInputToMinorUnits(amountText, currency) ?? Number.NaN },
      scope,
      minimumSpendMinor,
      usageLimit: convertOptionalWholeNumberText(usageLimitText),
      usageLimitPerCustomer: convertOptionalWholeNumberText(perCustomerText),
      startsAt: convertLocalDateTimeInputValueToIso(startsLocal) ?? "",
      endsAt: convertLocalDateTimeInputValueToIso(endsLocal),
    };
  }

  function submitPromotionForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = buildPromotionInputFromForm();
    const issues = validatePromotionInput(input);
    setFieldErrors(Object.fromEntries(issues.map((issue) => [issue.path, issue.message])));
    if (issues.length === 0) onSubmit(input);
  }

  const previewInput = buildPromotionInputFromForm();

  return (
    <form onSubmit={submitPromotionForm} noValidate className={styles.editorGrid}>
      <div className={styles.stack}>
        <FormErrorSummary messages={Object.values(fieldErrors)} />
        <Panel title="Basics">
          <div className={styles.stack}>
            <TextField label="Name" hint="Only your team sees this." value={name} onChange={(event) => setName(event.target.value)} maxLength={80} errorMessage={fieldErrors.name} />
            <SelectField label="Type" value={kind} onChange={(event) => setKind(event.target.value as Promotion["kind"])} options={(Object.keys(promotionKindLabel) as Promotion["kind"][]).map((value) => ({ value, label: promotionKindLabel[value] }))} hint={kind === "coupon" ? "Customers enter the code at checkout in the Nantty app." : kind === "automatic" ? "Applies by itself when the rules match." : "A storewide or category sale between two dates."} />
            {kind === "coupon" ? <TextField label="Coupon code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={24} errorMessage={fieldErrors.code} placeholder="WELCOME10" /> : null}
          </div>
        </Panel>
        <Panel title="Discount">
          <div className={styles.stack}>
            <SegmentedControl label="Discount type" value={discountKind} onValueChange={setDiscountKind} options={[{ value: "percent", label: "Percent off" }, { value: "amount", label: "Amount off" }]} />
            {discountKind === "percent" ? (
              <TextField label="Percent off" inputMode="decimal" value={percentText} onChange={(event) => setPercentText(event.target.value.replace(/[^\d.]/g, ""))} errorMessage={fieldErrors.discount} hint="Up to two decimal places, e.g. 12.5" />
            ) : (
              <MoneyField label="Amount off" currency={currency} valueText={amountText} onValueTextChange={setAmountText} errorMessage={fieldErrors.discount} />
            )}
            <PromotionScopePicker value={scope} onValueChange={setScope} errorMessage={fieldErrors.scope} />
          </div>
        </Panel>
        <Panel title="Rules">
          <div className={styles.row}>
            <MoneyField label="Minimum spend (optional)" currency={currency} valueText={minimumSpendText} onValueTextChange={setMinimumSpendText} errorMessage={fieldErrors.minimumSpend} />
            <TextField label="Total uses (optional)" inputMode="numeric" value={usageLimitText} onChange={(event) => setUsageLimitText(event.target.value.replace(/\D/g, ""))} errorMessage={fieldErrors.usageLimit} />
            <TextField label="Uses per customer (optional)" inputMode="numeric" value={perCustomerText} onChange={(event) => setPerCustomerText(event.target.value.replace(/\D/g, ""))} errorMessage={fieldErrors.usageLimitPerCustomer} />
          </div>
        </Panel>
        <Panel title="Schedule">
          <div className={styles.row}>
            <TextField label="Starts" type="datetime-local" value={startsLocal} onChange={(event) => setStartsLocal(event.target.value)} errorMessage={fieldErrors.startsAt} />
            <TextField label={kind === "scheduled_sale" ? "Ends" : "Ends (optional)"} type="datetime-local" value={endsLocal} min={startsLocal} onChange={(event) => setEndsLocal(event.target.value)} errorMessage={fieldErrors.endsAt} />
          </div>
        </Panel>
      </div>
      <div className={styles.stack}>
        <Panel title="Summary">
          <p className={styles.summaryLine}><strong>{previewInput.name || "Untitled promotion"}</strong></p>
          <p className={styles.summaryLine}>{Number.isNaN(previewInput.discount.value) ? "Set a discount" : describePromotionDiscount(previewInput, formatMoney, currency)} {scope.kind === "all" ? "everything" : `${scope.ids.length} ${scope.kind === "products" ? "product(s)" : "categories"}`}</p>
          {kind === "coupon" && previewInput.code ? <p className={styles.summaryLine}>Code <code className={styles.code}>{previewInput.code}</code></p> : null}
          <p className={styles.summaryLine}>Applies to orders in the Nantty app</p>
          <div style={{ marginTop: 12 }}>
            <Button type="submit" variant="primary" fullWidth isBusy={isSaving}>{promotion ? "Save promotion" : "Create promotion"}</Button>
          </div>
        </Panel>
      </div>
    </form>
  );
}
