import { buildDemoPlatformUsers } from "@/mocks/seed/demoPlatformUsers.mock";
import type { SupportMacro, SupportMessage, SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from "@/types/support.type";

export interface MockSupportTicketRecord {
  id: string;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  requesterUserId: string;
  assigneeAdminId: string | null;
  linkedOrderId: string | null;
  linkedDisputeId: string | null;
  createdAt: string;
  updatedAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  satisfactionScore: number | null;
  messages: SupportMessage[];
}

export interface MockSupportMacroRecord extends Omit<SupportMacro, "updatedAt" | "updatedByName"> {
  updatedAt: string;
  updatedByName: string;
}

export const firstResponseTargetMinutesByPriority: Record<SupportTicketPriority, number> = { URGENT: 60, HIGH: 240, NORMAL: 480, LOW: 1440 };
export const resolutionTargetMinutesByPriority: Record<SupportTicketPriority, number> = { URGENT: 480, HIGH: 1440, NORMAL: 2880, LOW: 4320 };

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

interface TicketSeed {
  readonly subject: string;
  readonly category: SupportTicketCategory;
  readonly priority: SupportTicketPriority;
  readonly status: SupportTicketStatus;
  readonly requesterUsername: string;
  readonly assignee: string | null;
  readonly orderId?: string;
  readonly disputeId?: string;
  readonly ageMinutes: number;
  readonly respondedAfterMinutes?: number;
  readonly conversation: readonly (readonly [SupportMessage["authorKind"], string, string])[];
}

const ticketSeeds: readonly TicketSeed[] = [
  { subject: "Paid for wig but seller has not shipped in 6 days", category: "ORDER", priority: "HIGH", status: "OPEN", requesterUsername: "halima.hijabs", assignee: null, orderId: "ord_7F3K2Q", ageMinutes: 310, conversation: [["CUSTOMER", "Halima Sadiq", "I paid on Tuesday and the seller keeps saying tomorrow. The escrow says held. Can you help?"]] },
  { subject: "Withdrawal to GTBank stuck on processing", category: "PAYMENT", priority: "URGENT", status: "OPEN", requesterUsername: "funke.naturals", assignee: "adm_0003", ageMinutes: 95, conversation: [["CUSTOMER", "Funke Naturals", "My withdrawal has been processing since morning. I need to pay my suppliers today."], ["INTERNAL_NOTE", "Ngozi Eze", "Flutterwave transfers to GTBank are degraded. Checking with payouts desk."]] },
  { subject: "Someone is using my brand name and photos", category: "SAFETY", priority: "HIGH", status: "OPEN", requesterUsername: "adaeze.styles", assignee: "adm_0003", ageMinutes: 540, respondedAfterMinutes: 40, conversation: [["CUSTOMER", "Adaeze Styles", "An account called adaeze_styles_official is copying my product photos and taking orders."], ["AGENT", "Ngozi Eze", "Thanks Adaeze. We've passed this to our trust team and will update you within a day."]] },
  { subject: "Gold verification still pending after 5 days", category: "VERIFICATION", priority: "NORMAL", status: "AWAITING_USER", requesterUsername: "chioma_threads", assignee: "adm_0002", ageMinutes: 2_900, respondedAfterMinutes: 120, conversation: [["CUSTOMER", "Chioma Threads", "I uploaded my CAC documents last week. When will my Gold badge be approved?"], ["AGENT", "Chidi Okafor", "Your documents are in review. We need a clearer photo of the director ID — please upload it from Settings > Verification."]] },
  { subject: "Item received is different from the listing", category: "ORDER", priority: "NORMAL", status: "OPEN", requesterUsername: "ken.otieno", assignee: null, orderId: "ord_9M1X4B", disputeId: "dsp_4Q8N2L", ageMinutes: 620, conversation: [["CUSTOMER", "Ken Otieno", "I ordered black sneakers size 44 and got brown size 42. I opened a dispute but nobody replied."]] },
  { subject: "Boosted post was rejected without a reason", category: "ADS", priority: "LOW", status: "OPEN", requesterUsername: "bolu.films", assignee: null, ageMinutes: 1_700, conversation: [["CUSTOMER", "Bolu Films", "My boost for the new short film trailer got rejected. What did I do wrong?"]] },
  { subject: "Can't log in after changing my phone number", category: "ACCOUNT", priority: "NORMAL", status: "OPEN", requesterUsername: "ngozi_bakes", assignee: "adm_0003", ageMinutes: 200, conversation: [["CUSTOMER", "Ngozi Bakes", "I changed my SIM and now the OTP goes to my old number."]] },
  { subject: "Charged twice for coins", category: "PAYMENT", priority: "HIGH", status: "AWAITING_USER", requesterUsername: "tomi.travels", assignee: "adm_0003", ageMinutes: 1_100, respondedAfterMinutes: 90, conversation: [["CUSTOMER", "Tomi Travels", "My card was charged twice for the 5,000 coin pack."], ["AGENT", "Ngozi Eze", "We can see one successful and one reversed charge. The reversal usually shows within 3 working days. Can you confirm by Friday?"]] },
  { subject: "Seller is threatening me in DMs", category: "SAFETY", priority: "URGENT", status: "OPEN", requesterUsername: "grace.decor", assignee: null, ageMinutes: 150, conversation: [["CUSTOMER", "Grace Decor", "A buyer I refunded keeps sending insults and threats in my messages. Screenshots attached."]] },
  { subject: "How do I become a Creator Program member?", category: "ACCOUNT", priority: "LOW", status: "RESOLVED", requesterUsername: "sipho.fits", assignee: "adm_0003", ageMinutes: 4_300, respondedAfterMinutes: 300, conversation: [["CUSTOMER", "Sipho Fits", "I want to go live and receive gifts. How do I join?"], ["AGENT", "Ngozi Eze", "You can apply from Profile > Creator Program once you meet the eligibility rules shown there."]] },
  { subject: "Refund not received after dispute won", category: "PAYMENT", priority: "HIGH", status: "OPEN", requesterUsername: "ifeoma.art", assignee: "adm_0002", orderId: "ord_2C6T9W", disputeId: "dsp_8H3R5K", ageMinutes: 1_600, respondedAfterMinutes: 600, conversation: [["CUSTOMER", "Ifeoma Art", "The dispute was decided in my favour 3 days ago but my wallet still shows zero."], ["AGENT", "Chidi Okafor", "Looking into the refund ledger entry now."]] },
  { subject: "Account suspended by mistake", category: "ACCOUNT", priority: "NORMAL", status: "CLOSED", requesterUsername: "dayo_deals", assignee: "adm_0002", ageMinutes: 9_000, respondedAfterMinutes: 200, conversation: [["CUSTOMER", "Dayo Deals", "Why is my shop suspended?"], ["AGENT", "Chidi Okafor", "Your store was suspended for repeated counterfeit listings. You can appeal from the app."]] },
];

export function buildDemoSupportTickets(): MockSupportTicketRecord[] {
  const userIdByUsername = new Map(buildDemoPlatformUsers().map((user) => [user.username, user.id]));
  return ticketSeeds.map((seed, index) => {
    const createdAt = minutesAgoIso(seed.ageMinutes);
    const messages: SupportMessage[] = seed.conversation.map(([authorKind, authorName, body], messageIndex) => ({
      id: `msg_${index + 1}_${messageIndex + 1}`,
      authorKind,
      authorName,
      body,
      createdAt: minutesAgoIso(seed.ageMinutes - messageIndex * Math.max(1, Math.floor((seed.respondedAfterMinutes ?? 20) / Math.max(1, seed.conversation.length - 1)))),
    }));
    return {
      id: `tkt_${String(10_421 + index)}`,
      subject: seed.subject,
      category: seed.category,
      priority: seed.priority,
      status: seed.status,
      requesterUserId: userIdByUsername.get(seed.requesterUsername) ?? "usr_0001",
      assigneeAdminId: seed.assignee,
      linkedOrderId: seed.orderId ?? null,
      linkedDisputeId: seed.disputeId ?? null,
      createdAt,
      updatedAt: messages[messages.length - 1]?.createdAt ?? createdAt,
      firstRespondedAt: seed.respondedAfterMinutes ? minutesAgoIso(seed.ageMinutes - seed.respondedAfterMinutes) : null,
      resolvedAt: seed.status === "RESOLVED" || seed.status === "CLOSED" ? minutesAgoIso(Math.floor(seed.ageMinutes / 3)) : null,
      satisfactionScore: seed.status === "CLOSED" ? 4 : null,
      messages,
    };
  });
}

export function buildDemoSupportMacros(): MockSupportMacroRecord[] {
  const updatedAt = minutesAgoIso(8_000);
  return [
    { id: "mac_01", title: "Escrow reassurance", category: "ORDER", body: "Hi {{user.displayName}}, your payment is safe in Zudomart escrow and the seller is only paid after you confirm delivery. If the order doesn't arrive by the delivery date, you can open a dispute from the order page.", updatedAt, updatedByName: "Tolu Adeyemi" },
    { id: "mac_02", title: "Withdrawal delay (provider)", category: "PAYMENT", body: "Hi {{user.displayName}}, our payment partner is processing transfers slower than usual today. Your withdrawal is queued and nothing is lost. We'll update this ticket as soon as it completes.", updatedAt, updatedByName: "Tolu Adeyemi" },
    { id: "mac_03", title: "Verification documents unclear", category: "VERIFICATION", body: "Hi {{user.displayName}}, we couldn't read one of your documents. Please upload a clear, uncropped photo from Settings > Verification and we'll review it within 2 working days.", updatedAt, updatedByName: "Chidi Okafor" },
    { id: "mac_04", title: "Safety report received", category: "SAFETY", body: "Hi {{user.displayName}}, thank you for telling us. Our trust and safety team is reviewing this now. You can block the account from their profile while we investigate.", updatedAt, updatedByName: "Ngozi Eze" },
    { id: "mac_05", title: "Ad policy explanation", category: "ADS", body: "Hi {{user.displayName}}, your boost didn't meet our advertising policy. You can edit the post and submit it again from the Boost screen.", updatedAt, updatedByName: "Ngozi Eze" },
    { id: "mac_06", title: "Closing — no reply", category: null, body: "Hi {{user.displayName}}, we haven't heard back so we're closing this ticket. Reply any time and it will reopen.", updatedAt, updatedByName: "Ngozi Eze" },
  ];
}
