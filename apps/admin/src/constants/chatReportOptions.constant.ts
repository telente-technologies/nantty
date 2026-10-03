import type { SelectOption } from "@/components/ui/formFields";
import type { ChatReportAction, ChatReportReason, ChatReportStatus } from "@/types/chatReport.type";
import { humanizeConstantName } from "@/utils/formatting.util";

const buildOptions = (values: readonly string[], allLabel: string): SelectOption[] => [{ value: "", label: allLabel }, ...values.map((value) => ({ value, label: humanizeConstantName(value) }))];

export const chatReportReasons: readonly ChatReportReason[] = [
  "CHILD_SAFETY", "SELF_HARM", "VIOLENCE_OR_THREATS", "HARASSMENT_OR_BULLYING", "HATE", "SEXUAL_CONTENT", "SPAM_OR_SCAM", "FRAUD_OR_PAYMENT_SCAM", "IMPERSONATION", "PROHIBITED_ITEMS", "OTHER",
];
export const chatReportStatuses: readonly ChatReportStatus[] = ["OPEN", "IN_REVIEW", "ACTIONED", "DISMISSED", "ESCALATED_LEGAL"];
export const chatReportActions: readonly ChatReportAction[] = ["DISMISS", "WARN_USER", "RESTRICT_USER", "SUSPEND_USER", "BAN_USER", "REMOVE_GROUP", "ESCALATE_LEGAL"];

export const chatReportReasonOptions = buildOptions(chatReportReasons, "All reasons");
export const chatReportPriorityOptions = buildOptions(["URGENT", "HIGH", "NORMAL", "LOW"], "All priorities");
export const chatReportStatusOptions = buildOptions(chatReportStatuses, "All statuses");
export const chatReportTargetTypeOptions = buildOptions(["USER", "MESSAGE", "CONVERSATION", "GROUP"], "All report types");
