"use client";

import { useState } from "react";

import { buildDefaultValueForRuleField, CustomerSegmentRuleEditor } from "@/components/customers/customerSegmentRuleEditor";
import { Button } from "@/components/ui/button";
import { FormErrorSummary, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CustomerSegment, CustomerSegmentInput, CustomerSegmentRule } from "@/types/customer.type";
import { validateCustomerSegmentInput } from "@/utils/customerSegmentRules.util";

import styles from "./customerSegments.module.css";

export function CustomerSegmentEditorDialog({ segment, onClose, onSaved }: { readonly segment: CustomerSegment | null; readonly onClose: () => void; readonly onSaved: (segment: CustomerSegment) => void }) {
  const { currency } = useMoneyFormatter();
  const { showToast } = useToast();
  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const [rules, setRules] = useState<CustomerSegmentRule[]>(segment?.rules ?? [{ field: "purchases_count", operator: "at_least", value: 2 }]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  async function saveSegment() {
    const input: CustomerSegmentInput = { name: name.trim(), description: description.trim(), rules };
    const issues = validateCustomerSegmentInput(input);
    setFieldErrors(Object.fromEntries(issues.map((issue) => [issue.path, issue.message])));
    if (issues.length > 0) return;
    setIsSaving(true);
    try {
      const saved = segment
        ? await sendSellerApiRequest<CustomerSegment>(`/seller/customers/segments/${encodeURIComponent(segment.id)}`, { method: "PATCH", body: input })
        : await sendSellerApiRequest<CustomerSegment>("/seller/customers/segments", { method: "POST", body: input });
      showToast(segment ? `Saved ${saved.name}.` : `Created ${saved.name} with ${saved.customerCount} customers.`);
      onSaved(saved);
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues?.length) setFieldErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalDialog intent="audience"
      isOpen
      onClose={onClose}
      width="large"
      title={segment ? `Edit ${segment.name}` : "New segment"}
      description="Customers who match every rule are in the segment. It updates by itself as people order."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={isSaving} onClick={() => void saveSegment()}>{segment ? "Save segment" : "Create segment"}</Button>
        </>
      }
    >
      <div className={styles.ruleStack}>
        <FormErrorSummary messages={Object.values(fieldErrors)} />
        <TextField label="Name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} errorMessage={fieldErrors.name} placeholder="e.g. Big spenders in Abuja" />
        <TextField label="Description (optional)" value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} errorMessage={fieldErrors.description} />
        <p className={styles.segmentName}>Rules</p>
        {currency
          ? rules.map((rule, index) => (
              <CustomerSegmentRuleEditor
                key={index}
                rule={rule}
                currency={currency}
                errorMessage={fieldErrors[`rules.${index}.value`]}
                onRuleChange={(nextRule) => setRules((current) => current.map((existing, existingIndex) => (existingIndex === index ? nextRule : existing)))}
                onRemove={() => setRules((current) => current.filter((_, existingIndex) => existingIndex !== index))}
              />
            ))
          : null}
        <div>
          <Button size="small" iconName="plus16" disabled={rules.length >= 8} onClick={() => setRules((current) => [...current, { field: "total_spent", operator: "at_least", value: buildDefaultValueForRuleField("total_spent") }])}>
            Add rule
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
