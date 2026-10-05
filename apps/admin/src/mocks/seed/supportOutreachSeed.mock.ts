import { isoMinutesAgo } from "@/mocks/seed/trustTime.mock";
import type { EmailSendRecord, EmailTemplate, LiveChatStatus } from "@/types/supportOutreach.type";

export interface MockLiveChatRecord {
  readonly id: string;
  readonly userId: string;
  status: LiveChatStatus;
  assigneeId: string | null;
  readonly startedAt: string;
  readonly topic: string;
  readonly messages: { id: string; authorKind: "CUSTOMER" | "AGENT"; authorName: string; body: string; createdAt: string }[];
  scriptedReplies: string[];
}

export function buildDemoLiveChats(): MockLiveChatRecord[] {
  return [
    { id: "chat_0001", userId: "usr_0013", status: "WAITING", assigneeId: null, startedAt: isoMinutesAgo(4), topic: "Payout delayed", scriptedReplies: ["Yes, the bank is GTBank ending 4021.", "Great, thank you for checking."], messages: [{ id: "cm_1", authorKind: "CUSTOMER", authorName: "Funke Naturals", body: "Hi, my payout from Monday has not reached my account yet.", createdAt: isoMinutesAgo(4) }] },
    { id: "chat_0002", userId: "usr_0026", status: "ACTIVE", assigneeId: "adm_0003", startedAt: isoMinutesAgo(22), topic: "Gold checkmark question", scriptedReplies: ["Understood. I will upload the proof of address now."], messages: [{ id: "cm_2", authorKind: "CUSTOMER", authorName: "Grace Decor", body: "Do I get the Gold checkmark as soon as I subscribe to Pro?", createdAt: isoMinutesAgo(22) }, { id: "cm_3", authorKind: "AGENT", authorName: "Ngozi Eze", body: "Hi Grace. Gold comes after your business documents are approved. Pro alone does not add it.", createdAt: isoMinutesAgo(19) }] },
    { id: "chat_0003", userId: "usr_0009", status: "ENDED", assigneeId: "adm_0003", startedAt: isoMinutesAgo(1500), topic: "Wrong item delivered", scriptedReplies: [], messages: [{ id: "cm_4", authorKind: "CUSTOMER", authorName: "Sipho Fits", body: "I received the wrong size.", createdAt: isoMinutesAgo(1500) }, { id: "cm_5", authorKind: "AGENT", authorName: "Ngozi Eze", body: "Sorry about that. I opened a dispute for you and the seller has been notified.", createdAt: isoMinutesAgo(1490) }] },
  ];
}

export function buildDemoEmailTemplates(): EmailTemplate[] {
  return [
    { id: "etpl_welcome_review", name: "Account under review", kind: "TRANSACTIONAL", subject: "We are reviewing your Zudomart account", body: "Hi {{user.displayName}},\n\nWe are taking a closer look at your account and will update you within 2 working days. You do not need to do anything now.\n\nThe Zudomart team" },
    { id: "etpl_docs_help", name: "Business documents reminder", kind: "TRANSACTIONAL", subject: "Finish your business documents", body: "Hi {{user.displayName}},\n\nUpload your CAC certificate, ID and proof of address from the dashboard. You can keep selling while we review them.\n\nThe Zudomart team" },
    { id: "etpl_seller_promo", name: "Seller tips newsletter", kind: "MARKETING", subject: "Three ways to get more orders this month", body: "Hi {{user.displayName}},\n\nHere are three practical tips to help your store this month.\n\nThe Zudomart team" },
  ];
}

export function buildDemoEmailSends(): EmailSendRecord[] {
  return [{ id: "esnd_0001", kind: "MARKETING", subject: "Seller tips newsletter", audienceLabel: "Segment: All sellers", recipientCount: 9, skippedNoMarketingConsent: 4, sentByName: "Chidi Okafor", sentAt: isoMinutesAgo(6000), provider: "AWS_SES" }];
}
