import type { EmailBrandConfig, EmailCategory, EmailKind, EmailSenderIdentity } from "../emailTypes";

type SendingMailbox = "noreply" | "notifications" | "receipts";

const sendingMailboxByCategory: Record<EmailCategory, SendingMailbox> = {
  auth: "noreply",
  orders: "noreply",
  escrow: "noreply",
  seller: "noreply",
  payments: "receipts",
  creator: "noreply",
  checkmarks: "noreply",
  social: "notifications",
  milestones: "notifications",
  trust: "noreply",
  privacy: "noreply",
  support: "noreply",
  marketing: "notifications",
};

const replyMailboxByCategory: Record<EmailCategory, string> = {
  auth: "support",
  orders: "support",
  escrow: "support",
  seller: "sellers",
  payments: "billing",
  creator: "creators",
  checkmarks: "verification",
  social: "support",
  milestones: "support",
  trust: "trustandsafety",
  privacy: "privacy",
  support: "support",
  marketing: "hello",
};

const copyrightTemplateKeys = new Set(["copyrightWarning", "audioMuted", "contentTakenDown", "counterNoticeReceived", "contentRestored"]);

const senderLabelBySendingMailbox: Record<SendingMailbox, string> = { noreply: "", notifications: "", receipts: " Receipts" };

export function selectEmailSender(brand: EmailBrandConfig, category: EmailCategory, kind: EmailKind, templateKey?: string): EmailSenderIdentity {
  const mailbox = sendingMailboxByCategory[category];
  const replyMailbox = templateKey !== undefined && copyrightTemplateKeys.has(templateKey) ? "copyright" : kind === "security" ? "support" : replyMailboxByCategory[category];
  const replyTo = replyMailbox === "support" ? (brand.supportEmails[0] ?? `support@${brand.mailboxDomain}`) : `${replyMailbox}@${brand.mailboxDomain}`;
  return { from: `${brand.senderName}${senderLabelBySendingMailbox[mailbox]} <${mailbox}@${brand.sendingDomain}>`, replyTo };
}
