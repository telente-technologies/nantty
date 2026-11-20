import { consentRules, defineEmailTemplate } from "./defineTemplate";

export interface AdminNoticeProps {
  readonly subjectLine: string;
  readonly paragraphs: readonly string[];
}

const sampleParagraphs = [
  "Hi Amaka, we have updated seller payout schedules ahead of the upcoming holiday weekend.",
  "Payout requests submitted before 14:00 WAT will continue settling the same business day.",
] as const;

export const adminNoticeTransactional = defineEmailTemplate<AdminNoticeProps>({
  category: "support",
  kind: "transactional",
  audience: "Recipient of an administrative notice",
  consent: consentRules.always,
  key: "adminNoticeTransactional",
  name: "Administrative notice (transactional)",
  trigger: "admin.email.transactional",
  subject: (p) => p.subjectLine,
  preheader: (p) => (p.paragraphs[0] ?? p.subjectLine).slice(0, 90),
  blocks: (p) => [
    { type: "hero", eyebrow: "Nantty notice", title: p.subjectLine },
    ...p.paragraphs.map((text) => ({ type: "paragraph" as const, text })),
  ],
  sample: {
    subjectLine: "Scheduled payout window update",
    paragraphs: sampleParagraphs,
  },
});

export const adminNoticeMarketing = defineEmailTemplate<AdminNoticeProps>({
  category: "marketing",
  kind: "marketing",
  audience: "Users with marketing consent receiving an admin campaign",
  consent: consentRules.marketing,
  key: "adminNoticeMarketing",
  name: "Administrative campaign (marketing)",
  trigger: "admin.email.marketing",
  subject: (p) => p.subjectLine,
  preheader: (p) => (p.paragraphs[0] ?? p.subjectLine).slice(0, 90),
  blocks: (p) => [
    { type: "hero", eyebrow: "Nantty updates", title: p.subjectLine },
    ...p.paragraphs.map((text) => ({ type: "paragraph" as const, text })),
  ],
  sample: {
    subjectLine: "What is new on Nantty this month",
    paragraphs: sampleParagraphs,
  },
});
