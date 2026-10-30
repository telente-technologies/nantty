export const reportTargetTypes = ["user", "message", "conversation", "group", "post", "comment", "clip", "live", "space", "product", "store", "sound"] as const;
export type ReportTargetType = (typeof reportTargetTypes)[number];

export const currentReportReasons = [
  "child_safety", "self_harm", "violence", "harassment", "hate", "sexual_content", "spam", "fraud", "impersonation", "prohibited_items", "scam",
  "intellectual_property", "counterfeit", "misinformation", "other",
] as const;

const legacyReasonAliases: Readonly<Record<string, (typeof currentReportReasons)[number]>> = {
  scam_or_fraud: "scam", counterfeit_product: "counterfeit", nudity_or_sexual_content: "sexual_content", nudity: "sexual_content", hate_or_harassment: "harassment",
  something_else: "other", violence_or_threats: "violence", prohibited_goods: "prohibited_items", personal_data: "other",
};

export const acceptedReportReasons = [...currentReportReasons, ...Object.keys(legacyReasonAliases)] as [string, ...string[]];

export function normaliseReportReason(raw: string): string {
  return legacyReasonAliases[raw] ?? raw;
}

const moderationReasonNames: Readonly<Record<string, string>> = { prohibited_items: "prohibited_goods" };

export function moderationReasonFor(reason: string): string {
  return moderationReasonNames[reason] ?? reason;
}
