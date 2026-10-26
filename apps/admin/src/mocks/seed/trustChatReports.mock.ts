import { isoMinutesAgo, reportSlaMinutesByPriority } from "@/mocks/seed/trustTime.mock";
import type { ChatEvidenceAttachment, ChatReportDecision, ChatReportReason, ChatReportSpamScore, ChatReportStatus, ChatReportTargetType, ReporterOutcome } from "@/types/chatReport.type";
import type { ReportPriority } from "@/types/moderation.type";

export interface MockChatEvidenceMessage {
  readonly messageId: string;
  readonly senderUserId: string;
  readonly senderName: string;
  readonly sentAt: string;
  readonly text: string;
  readonly attachments: readonly ChatEvidenceAttachment[];
}

export interface MockChatReportRecord {
  id: string;
  targetType: ChatReportTargetType;
  reason: ChatReportReason;
  priority: ReportPriority;
  status: ChatReportStatus;
  reporterUserId: string;
  reportedUserId: string | null;
  conversationLabel: string;
  createdAt: string;
  slaDueAt: string;
  details: string;
  evidenceSelection: "last_messages" | "picked_messages" | null;
  evidenceHash: string | null;
  evidenceRetainedUntil: string | null;
  reporterBlockedReportedUser: boolean;
  transcript: MockChatEvidenceMessage[];
  spamScore: ChatReportSpamScore | null;
  isLegalReview: boolean;
  decision: ChatReportDecision | null;
  reporterOutcome: ReporterOutcome | null;
}

const noAttachments: readonly ChatEvidenceAttachment[] = [];
const imageAttachment: ChatEvidenceAttachment = { type: "image", mimeType: "image/jpeg", fileName: null, sizeBytes: 482_113, durationSeconds: null };
const documentAttachment: ChatEvidenceAttachment = { type: "document", mimeType: "application/pdf", fileName: "receipt-3391.pdf", sizeBytes: 91_204, durationSeconds: null };

interface Line {
  readonly from: string;
  readonly name: string;
  readonly minutesAgo: number;
  readonly text: string;
  readonly attachments?: readonly ChatEvidenceAttachment[];
}

const buildTranscript = (reportId: string, lines: readonly Line[]): MockChatEvidenceMessage[] =>
  lines.map((line, index) => ({ messageId: `msg_${reportId}_${index + 1}`, senderUserId: line.from, senderName: line.name, sentAt: isoMinutesAgo(line.minutesAgo), text: line.text, attachments: line.attachments ?? noAttachments }));

interface SeedRow {
  readonly id: string;
  readonly targetType: ChatReportTargetType;
  readonly reason: ChatReportReason;
  readonly priority: ReportPriority;
  readonly status?: ChatReportStatus;
  readonly reporter: string;
  readonly reported: string | null;
  readonly label: string;
  readonly minutesAgo: number;
  readonly details: string;
  readonly selection: "last_messages" | "picked_messages" | null;
  readonly lines: readonly Line[];
  readonly spam?: ChatReportSpamScore;
  readonly blocked?: boolean;
  readonly decision?: { chatAction: ChatReportDecision["chatAction"]; reason: string; by: string; minutesAgo: number };
  readonly outcome?: ReporterOutcome;
}

const seedRows: readonly SeedRow[] = [
  {
    id: "chr_0001", targetType: "CONVERSATION", reason: "CHILD_SAFETY", priority: "URGENT", reporter: "usr_0014", reported: "usr_0009", label: "Direct chat", minutesAgo: 18,
    details: "This adult keeps asking my 14 year old cousin to move to another app and send photos.", selection: "last_messages",
    lines: [
      { from: "usr_0009", name: "Tunde Gadgets", minutesAgo: 95, text: "How old are you again? Don't tell your parents we talk" },
      { from: "usr_0014", name: "Kemi Kitchen", minutesAgo: 92, text: "I am 14" },
      { from: "usr_0009", name: "Tunde Gadgets", minutesAgo: 90, text: "Perfect. Send me a picture, I will send you airtime." },
    ],
    spam: { score: 0.31, signals: ["Moves chats off platform", "Contacted 4 accounts under 16 this week"], source: "Intelligence service" },
  },
  {
    id: "chr_0002", targetType: "MESSAGE", reason: "FRAUD_OR_PAYMENT_SCAM", priority: "HIGH", reporter: "usr_0003", reported: "usr_0005", label: "Direct chat", minutesAgo: 140,
    details: "Asked me to pay into a personal account to hold the phone.", selection: "picked_messages", blocked: true,
    lines: [
      { from: "usr_0005", name: "Chukwuemeka Obi", minutesAgo: 190, text: "Escrow takes too long. Send ₦120,000 to this account 0481 and I ship today." },
      { from: "usr_0005", name: "Chukwuemeka Obi", minutesAgo: 189, text: "Here is my receipt for the last buyer", attachments: [documentAttachment] },
    ],
    spam: { score: 0.82, signals: ["Duplicate message sent to 41 accounts", "Off-platform payment request"], source: "Intelligence service" },
  },
  {
    id: "chr_0003", targetType: "GROUP", reason: "SPAM_OR_SCAM", priority: "NORMAL", reporter: "usr_0008", reported: null, label: "Group: Lagos Flash Deals", minutesAgo: 360,
    details: "Every hour the admin posts crypto doubling links.", selection: "last_messages",
    lines: [
      { from: "usr_0012", name: "Admin Deals", minutesAgo: 420, text: "Double your naira in 24h. Join now: bit.ly/zz-double" },
      { from: "usr_0012", name: "Admin Deals", minutesAgo: 360, text: "Double your naira in 24h. Join now: bit.ly/zz-double" },
    ],
    spam: { score: 0.93, signals: ["Duplicate ratio 0.97", "Shortened links to a flagged domain"], source: "Intelligence service" },
  },
  {
    id: "chr_0004", targetType: "USER", reason: "SELF_HARM", priority: "HIGH", reporter: "usr_0006", reported: "usr_0011", label: "Direct chat", minutesAgo: 55,
    details: "They said they don't want to be here anymore.", selection: null, lines: [],
  },
  {
    id: "chr_0005", targetType: "MESSAGE", reason: "HARASSMENT_OR_BULLYING", priority: "NORMAL", reporter: "usr_0004", reported: "usr_0016", label: "Direct chat", minutesAgo: 900,
    details: "Repeated insults after I declined to sell.", selection: "picked_messages",
    lines: [
      { from: "usr_0016", name: "Ife Beats", minutesAgo: 960, text: "You are useless and everybody knows it", attachments: [imageAttachment] },
      { from: "usr_0004", name: "Obinna Tech", minutesAgo: 958, text: "Please stop messaging me." },
      { from: "usr_0016", name: "Ife Beats", minutesAgo: 955, text: "I will keep going until you answer." },
    ],
  },
  {
    id: "chr_0006", targetType: "CONVERSATION", reason: "IMPERSONATION", priority: "NORMAL", status: "ACTIONED", reporter: "usr_0010", reported: "usr_0013", label: "Direct chat", minutesAgo: 3000,
    details: "Pretends to be Nantty support and asks for my OTP.", selection: "last_messages",
    lines: [{ from: "usr_0013", name: "Nantty Help", minutesAgo: 3050, text: "We detected a problem. Send the code we texted you to confirm your account." }],
    decision: { chatAction: "SUSPEND_USER", reason: "Impersonating Nantty support to collect OTPs.", by: "Amaka Obi", minutesAgo: 2900 }, outcome: "TOOK_ACTION",
  },
  {
    id: "chr_0007", targetType: "MESSAGE", reason: "HATE", priority: "NORMAL", status: "DISMISSED", reporter: "usr_0007", reported: "usr_0015", label: "Group: Naija Sneaker Heads", minutesAgo: 4200,
    details: "Rude comment about my accent.", selection: "picked_messages",
    lines: [{ from: "usr_0015", name: "Seyi Sneakers", minutesAgo: 4300, text: "Your accent is funny but your prices are fine lol" }],
    decision: { chatAction: "DISMISS", reason: "Rude but not hateful. Reporter pointed to the block and restrict tools.", by: "Amaka Obi", minutesAgo: 4100 }, outcome: "NO_VIOLATION",
  },
  {
    id: "chr_0008", targetType: "CONVERSATION", reason: "VIOLENCE_OR_THREATS", priority: "HIGH", status: "ESCALATED_LEGAL", reporter: "usr_0002", reported: "usr_0018", label: "Direct chat", minutesAgo: 1700,
    details: "He said he knows where I live and will come to my shop.", selection: "last_messages",
    lines: [
      { from: "usr_0018", name: "Dayo Auto", minutesAgo: 1760, text: "I know your shop on Allen Avenue. Refund me tonight or you will see." },
      { from: "usr_0018", name: "Dayo Auto", minutesAgo: 1759, text: "Don't test me." },
    ],
    decision: { chatAction: "ESCALATE_LEGAL", reason: "Credible threat naming a location. Sent to legal for law-enforcement review.", by: "Amaka Obi", minutesAgo: 1600 },
  },
];

export function buildDemoChatReports(): MockChatReportRecord[] {
  return seedRows.map((row) => ({
    id: row.id,
    targetType: row.targetType,
    reason: row.reason,
    priority: row.priority,
    status: row.status ?? "OPEN",
    reporterUserId: row.reporter,
    reportedUserId: row.reported,
    conversationLabel: row.label,
    createdAt: isoMinutesAgo(row.minutesAgo),
    slaDueAt: isoMinutesAgo(row.minutesAgo - reportSlaMinutesByPriority[row.priority]),
    details: row.details,
    evidenceSelection: row.selection,
    evidenceHash: row.lines.length > 0 ? `sha256:${row.id.replace("chr_", "")}9f3c1ab07d52e8c4b6a1f09d3e7c5528a4b1d6e0f7c93a28b5d4e1f60a7c93` : null,
    evidenceRetainedUntil: row.lines.length > 0 ? isoMinutesAgo(-180 * 1440 + row.minutesAgo) : null,
    reporterBlockedReportedUser: row.blocked ?? false,
    transcript: buildTranscript(row.id, row.lines),
    spamScore: row.spam ?? null,
    isLegalReview: row.status === "ESCALATED_LEGAL",
    decision: row.decision
      ? { chatAction: row.decision.chatAction, reason: row.decision.reason, decidedByName: row.decision.by, decidedAt: isoMinutesAgo(row.decision.minutesAgo), suspensionDays: row.decision.chatAction === "SUSPEND_USER" ? 7 : null }
      : null,
    reporterOutcome: row.outcome ?? null,
  }));
}
