import type { AutomationCatalog, AutomationExecution, AutomationRuleContent, AutomationSampleEvent } from "@/types/automation.type";

export const automationCatalog: AutomationCatalog = {
  events: [
    { key: "order.delivered", label: "Order delivered", fields: [{ key: "orderTotalMinor", label: "Order total (minor units)", type: "money" }, { key: "currency", label: "Currency", type: "text" }, { key: "sellerRiskLevel", label: "Seller risk level", type: "text" }, { key: "buyerCountry", label: "Buyer country", type: "text" }] },
    { key: "dispute.opened", label: "Dispute opened", fields: [{ key: "reason", label: "Reason", type: "text" }, { key: "orderTotalMinor", label: "Order total (minor units)", type: "money" }, { key: "sellerOpenDisputes", label: "Seller open disputes", type: "number" }] },
    { key: "report.created", label: "Report created", fields: [{ key: "targetType", label: "Target type", type: "text" }, { key: "category", label: "Category", type: "text" }, { key: "reportsInLastHour", label: "Reports on target in last hour", type: "number" }] },
    { key: "payout.requested", label: "Withdrawal requested", fields: [{ key: "amountMinor", label: "Amount (minor units)", type: "money" }, { key: "currency", label: "Currency", type: "text" }, { key: "fraudScore", label: "Fraud score (0-100)", type: "number" }, { key: "accountAgeDays", label: "Account age in days", type: "number" }] },
    { key: "user.strike_added", label: "Strike added to user", fields: [{ key: "activeStrikes", label: "Active strikes", type: "number" }, { key: "strikeKind", label: "Strike kind", type: "text" }, { key: "isVerified", label: "Is verified", type: "boolean" }] },
  ],
  operators: [
    { key: "EQUALS", label: "is" },
    { key: "NOT_EQUALS", label: "is not" },
    { key: "GREATER_THAN", label: "is greater than" },
    { key: "LESS_THAN", label: "is less than" },
    { key: "CONTAINS", label: "contains" },
    { key: "IN", label: "is one of (comma separated)" },
  ],
  actions: [
    { type: "notify_user", label: "Notify the user", parameters: [{ key: "templateId", label: "Template ID" }] },
    { type: "add_to_queue", label: "Add to a review queue", parameters: [{ key: "queue", label: "Queue" }, { key: "priority", label: "Priority" }] },
    { type: "hold_payout", label: "Hold the payout for review", parameters: [{ key: "holdHours", label: "Hold for (hours)" }] },
    { type: "auto_hide_content", label: "Hide the content until reviewed", parameters: [] },
    { type: "assign_ticket", label: "Open and assign a support ticket", parameters: [{ key: "team", label: "Team" }] },
  ],
};

export function buildInitialAutomationRules(): { id: string; content: AutomationRuleContent; changeReason: string }[] {
  return [
    { id: "rule_hold_risky_payouts", changeReason: "Fraud desk request after September chargebacks.", content: { name: "Hold risky withdrawals", description: "Hold withdrawals with a high fraud score from new accounts.", isEnabled: true, event: "payout.requested", conditionMatch: "ALL", conditions: [{ field: "fraudScore", operator: "GREATER_THAN", value: "70" }, { field: "accountAgeDays", operator: "LESS_THAN", value: "30" }], actions: [{ type: "hold_payout", parameters: { holdHours: "48" } }, { type: "add_to_queue", parameters: { queue: "payouts", priority: "HIGH" } }] } },
    { id: "rule_mass_report_autohide", changeReason: "Brigading protection for creators.", content: { name: "Auto-hide mass-reported content", description: "Hide content reported for violence 10+ times in an hour until reviewed.", isEnabled: true, event: "report.created", conditionMatch: "ALL", conditions: [{ field: "category", operator: "IN", value: "VIOLENCE,CHILD_SAFETY" }, { field: "reportsInLastHour", operator: "GREATER_THAN", value: "9" }], actions: [{ type: "auto_hide_content", parameters: {} }, { type: "add_to_queue", parameters: { queue: "reports", priority: "URGENT" } }] } },
    { id: "rule_dispute_repeat_seller", changeReason: "Support escalation policy.", content: { name: "Escalate repeat-dispute sellers", description: "Open a ticket for sellers with 3+ open disputes.", isEnabled: false, event: "dispute.opened", conditionMatch: "ANY", conditions: [{ field: "sellerOpenDisputes", operator: "GREATER_THAN", value: "2" }], actions: [{ type: "assign_ticket", parameters: { team: "Seller success" } }] } },
  ];
}

export const automationSampleEvents: readonly AutomationSampleEvent[] = [
  { id: "sample_payout_new_account", event: "payout.requested", label: "₦1.2m withdrawal from a 9-day-old account", payload: { amountMinor: 120_000_000, currency: "NGN", fraudScore: 82, accountAgeDays: 9 } },
  { id: "sample_payout_trusted", event: "payout.requested", label: "GH₵800 withdrawal from a 2-year-old creator", payload: { amountMinor: 80_000, currency: "GHS", fraudScore: 12, accountAgeDays: 740 } },
  { id: "sample_report_brigade", event: "report.created", label: "14 violence reports on a clip in an hour", payload: { targetType: "CLIP", category: "VIOLENCE", reportsInLastHour: 14 } },
  { id: "sample_dispute", event: "dispute.opened", label: "Dispute on a seller with 4 open disputes", payload: { reason: "ITEM_NOT_AS_DESCRIBED", orderTotalMinor: 4_500_000, sellerOpenDisputes: 4 } },
  { id: "sample_delivered", event: "order.delivered", label: "₦45,000 order delivered in Lagos", payload: { orderTotalMinor: 4_500_000, currency: "NGN", sellerRiskLevel: "LOW", buyerCountry: "NG" } },
  { id: "sample_strike", event: "user.strike_added", label: "Third copyright strike on a verified creator", payload: { activeStrikes: 3, strikeKind: "COPYRIGHT", isVerified: true } },
];

export function buildInitialAutomationExecutions(): AutomationExecution[] {
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  return [
    { id: "exe_0001", ruleId: "rule_hold_risky_payouts", ruleName: "Hold risky withdrawals", event: "payout.requested", subjectLabel: "Withdrawal wd_8f2 · @dayo_deals", occurredAt: minutesAgo(12), outcome: "ACTIONS_RUN", actionsRun: ["hold_payout", "add_to_queue"], errorMessage: null },
    { id: "exe_0002", ruleId: "rule_mass_report_autohide", ruleName: "Auto-hide mass-reported content", event: "report.created", subjectLabel: "Clip clp_91a · @bolu.films", occurredAt: minutesAgo(47), outcome: "CONDITIONS_NOT_MET", actionsRun: [], errorMessage: null },
    { id: "exe_0003", ruleId: "rule_hold_risky_payouts", ruleName: "Hold risky withdrawals", event: "payout.requested", subjectLabel: "Withdrawal wd_7c1 · @kwame.beats", occurredAt: minutesAgo(95), outcome: "CONDITIONS_NOT_MET", actionsRun: [], errorMessage: null },
    { id: "exe_0004", ruleId: "rule_mass_report_autohide", ruleName: "Auto-hide mass-reported content", event: "report.created", subjectLabel: "Live lv_22d · @emeka.gadgets", occurredAt: minutesAgo(180), outcome: "FAILED", actionsRun: ["auto_hide_content"], errorMessage: "Queue service timed out after hiding; review item not created." },
  ];
}
