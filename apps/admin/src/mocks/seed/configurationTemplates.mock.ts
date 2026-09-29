import type { NotificationTemplateContent, TemplateVariable } from "@/types/notificationTemplate.type";

const variablesByEvent: Record<string, TemplateVariable[]> = {
  "username.withheld": [{ name: "displayName", sampleValue: "Adaeze" }, { name: "oldUsername", sampleValue: "adaeze.styles" }, { name: "newUsername", sampleValue: "user_58213" }, { name: "reason", sampleValue: "The username impersonates a public figure." }],
  "payout.completed": [{ name: "displayName", sampleValue: "Kwame" }, { name: "amount", sampleValue: "GH₵800.00" }, { name: "bankName", sampleValue: "GCB Bank" }, { name: "reference", sampleValue: "WD-7C1-2291" }],
  "dispute.resolved": [{ name: "displayName", sampleValue: "Tunde" }, { name: "orderNumber", sampleValue: "ZM-104233" }, { name: "outcome", sampleValue: "partial refund" }, { name: "refundAmount", sampleValue: "₦12,500.00" }],
  "verification.approved": [{ name: "displayName", sampleValue: "Funke" }, { name: "badgeName", sampleValue: "Gold Pro" }],
};

type TemplateSeed = Omit<NotificationTemplateContent, "variables">;

const templateSeeds: TemplateSeed[] = [
  { event: "username.withheld", channel: "PUSH", locale: "en", isEnabled: true, subject: null, body: "Your username @{{oldUsername}} was changed to @{{newUsername}}. Tap to see why." },
  { event: "username.withheld", channel: "EMAIL", locale: "en", isEnabled: true, subject: "Your Zudomart username was changed", body: "Hi {{displayName}},\n\nWe changed your username from @{{oldUsername}} to @{{newUsername}}.\n\nReason: {{reason}}\n\nYou can pick a new username in Settings. If you think this is a mistake, reply to appeal." },
  { event: "username.withheld", channel: "IN_APP", locale: "pcm", isEnabled: false, subject: null, body: "{{displayName}}, we don change your username from @{{oldUsername}} to @{{newUsername}}. Reason: {{reason}}" },
  { event: "payout.completed", channel: "PUSH", locale: "en", isEnabled: true, subject: null, body: "{{amount}} is on its way to your {{bankName}} account. Ref {{reference}}." },
  { event: "payout.completed", channel: "SMS", locale: "en", isEnabled: true, subject: null, body: "Zudomart: {{amount}} sent to {{bankName}}. Ref {{reference}}." },
  { event: "dispute.resolved", channel: "EMAIL", locale: "en", isEnabled: true, subject: "Your dispute on order {{orderNumber}} is resolved", body: "Hi {{displayName}},\n\nWe reviewed order {{orderNumber}} and decided on a {{outcome}}. Refund: {{refundAmount}}.\n\nThanks for your patience." },
  { event: "dispute.resolved", channel: "EMAIL", locale: "fr", isEnabled: true, subject: "Votre litige sur la commande {{orderNumber}} est résolu", body: "Bonjour {{displayName}},\n\nNous avons examiné la commande {{orderNumber}} : {{outcome}}. Remboursement : {{refundAmount}}." },
  { event: "verification.approved", channel: "IN_APP", locale: "en", isEnabled: true, subject: null, body: "Congratulations {{displayName}}, your {{badgeName}} verification is approved." },
];

export function buildTemplateIdentifier(event: string, channel: string, locale: string): string {
  return `${event}.${channel.toLowerCase()}.${locale}`;
}

export function readTemplateVariablesForEvent(event: string): TemplateVariable[] {
  return variablesByEvent[event] ?? [];
}

export function buildInitialNotificationTemplates(): { id: string; content: NotificationTemplateContent; changeReason: string }[] {
  return templateSeeds.map((seed) => ({ id: buildTemplateIdentifier(seed.event, seed.channel, seed.locale), content: { ...seed, variables: readTemplateVariablesForEvent(seed.event) }, changeReason: "Initial copy from content design." }));
}
