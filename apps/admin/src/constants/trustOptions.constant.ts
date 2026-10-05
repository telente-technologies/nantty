import type { SelectOption } from "@/components/ui/formFields";
import { humanizeConstantName } from "@/utils/formatting.util";

function buildOptions(values: readonly string[], allLabel: string): SelectOption[] {
  return [{ value: "", label: allLabel }, ...values.map((value) => ({ value, label: humanizeConstantName(value) }))];
}

export const reportTargetTypeOptions = buildOptions(["POST", "COMMENT", "CLIP", "LIVE", "USER", "PRODUCT", "STORE", "SOUND"], "All content types");
export const reportReasonOptions = buildOptions(["SPAM", "SCAM", "HARASSMENT", "HATE", "NUDITY", "VIOLENCE", "COUNTERFEIT", "IMPERSONATION", "MISINFORMATION", "SELF_HARM", "OTHER"], "All reasons");
export const reportPriorityOptions = buildOptions(["URGENT", "HIGH", "NORMAL", "LOW"], "All priorities");
export const appealDecisionTypeOptions = buildOptions(["CONTENT_REMOVED", "CONTENT_RESTRICTED", "STRIKE", "SUSPENSION", "COPYRIGHT_TAKEDOWN"], "All decision types");
export const copyrightWorkTypeOptions = buildOptions(["SOUND", "VIDEO", "IMAGE", "TEXT"], "All work types");
export const suspensionDurationOptions: SelectOption[] = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];
export const policySeverityOptions: SelectOption[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ value, label: humanizeConstantName(value) }));

export const suspensionReasonOptions: SelectOption[] = ["FRAUD", "SCAM", "COUNTERFEIT", "HARASSMENT", "IMPERSONATION", "SPAM_NETWORK", "OTHER"].map((value) => ({ value, label: humanizeConstantName(value) }));
export const suspensionSourceOptions = buildOptions(["PYTHON_SUGGESTION", "USER_REPORTS", "COPYRIGHT_STRIKES"], "All sources");
