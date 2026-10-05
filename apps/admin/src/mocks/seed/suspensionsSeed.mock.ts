import { isoMinutesAgo } from "@/mocks/seed/trustTime.mock";
import type { SuspensionAppeal, SuspensionCaseSource, SuspensionCaseStatus, SuspensionDecision, SuspensionEvidenceLink, SuspensionReasonCode, SuspensionSignal, SuspensionUserReport } from "@/types/suspensions.type";

export interface MockSuspensionCaseRecord {
  readonly id: string;
  readonly userId: string;
  readonly source: SuspensionCaseSource;
  readonly modelVersion?: string;
  status: SuspensionCaseStatus;
  readonly riskScore: number;
  readonly signals: readonly SuspensionSignal[];
  readonly evidence: readonly SuspensionEvidenceLink[];
  readonly reports: readonly SuspensionUserReport[];
  readonly createdAt: string;
  decision: SuspensionDecision | null;
  suspension: { reasonCode: SuspensionReasonCode; suspendedAt: string; suspendedByName: string } | null;
  appeal: SuspensionAppeal | null;
  isReinstated: boolean;
}

const dayMinutes = 1440;
const proofLinks = (userId: string): SuspensionEvidenceLink[] => [{ label: "Open the profile", href: `/users/${userId}` }, { label: "Orders and escrow", href: "/commerce/orders" }, { label: "Open reports on this user", href: "/moderation/reports" }];

export function buildDemoSuspensionCases(): MockSuspensionCaseRecord[] {
  const base = { decision: null, suspension: null, appeal: null, isReinstated: false } as const;
  return [
    { ...base, id: "susp_0001", userId: "usr_0014", source: "PYTHON_SUGGESTION", status: "PENDING", riskScore: 91, createdAt: isoMinutesAgo(95), signals: [{ label: "Payment-reversal ring", weight: 40, detail: "7 buyers on the same device cluster filed chargebacks in 9 days." }, { label: "Listing velocity", weight: 28, detail: "46 vehicle listings in 2 hours, all with stock photos." }, { label: "New account, high-value goods", weight: 23, detail: "Account is 60 days old with listings above NGN 8,000,000." }], evidence: proofLinks("usr_0014"), reports: [{ id: "rep_9101", reason: "SCAM", excerpt: "Took my deposit and stopped replying.", reportedAt: isoMinutesAgo(400) }] },
    { ...base, id: "susp_0002", userId: "usr_0018", source: "PYTHON_SUGGESTION", status: "PENDING", riskScore: 78, createdAt: isoMinutesAgo(300), signals: [{ label: "Follow/unfollow bursts", weight: 44, detail: "3,100 follows in 40 minutes across 12 sessions." }, { label: "Comment duplication", weight: 34, detail: "Same promo comment on 880 posts." }], evidence: proofLinks("usr_0018"), reports: [] },
    { ...base, id: "susp_0003", userId: "usr_0027", source: "USER_REPORTS", status: "PENDING", riskScore: 64, createdAt: isoMinutesAgo(1100), signals: [{ label: "Report volume", weight: 40, detail: "11 distinct reporters in 48 hours." }, { label: "Impersonation reports", weight: 24, detail: "8 of 11 reports say the profile impersonates a bank." }], evidence: proofLinks("usr_0027"), reports: [{ id: "rep_9120", reason: "IMPERSONATION", excerpt: "Pretends to be a bank support agent in DMs.", reportedAt: isoMinutesAgo(700) }, { id: "rep_9121", reason: "SCAM", excerpt: "Asked for my card PIN.", reportedAt: isoMinutesAgo(650) }] },
    { ...base, id: "susp_0004", userId: "usr_0023", source: "PYTHON_SUGGESTION", status: "ESCALATED", riskScore: 83, createdAt: isoMinutesAgo(2 * dayMinutes), signals: [{ label: "Counterfeit listing similarity", weight: 52, detail: "Image hashes match 14 listings removed for counterfeit claims." }, { label: "Prior strike", weight: 31, detail: "1 active strike, 2 counterfeit appeals lost." }], evidence: proofLinks("usr_0023"), reports: [{ id: "rep_9130", reason: "COUNTERFEIT", excerpt: "Fake Nike boxes, serials do not scan.", reportedAt: isoMinutesAgo(2000) }], decision: { outcome: "ESCALATED", reasonCode: null, reason: "High-value seller. Need senior sign-off before suspending.", decidedByName: "Tolu Adeyemi", decidedAt: isoMinutesAgo(dayMinutes) } },
    { ...base, id: "susp_0005", userId: "usr_0016", source: "USER_REPORTS", status: "PENDING", riskScore: 52, createdAt: isoMinutesAgo(3 * dayMinutes), signals: [{ label: "Report volume", weight: 30, detail: "6 reporters in 7 days." }, { label: "Copyright strike history", weight: 22, detail: "1 copyright strike 41 days ago." }], evidence: proofLinks("usr_0016"), reports: [{ id: "rep_9140", reason: "HARASSMENT", excerpt: "Targets one creator in every live.", reportedAt: isoMinutesAgo(3500) }] },
    { ...base, id: "susp_0006", userId: "usr_0019", source: "PYTHON_SUGGESTION", modelVersion: "engagement_integrity", status: "PENDING", riskScore: 86, createdAt: isoMinutesAgo(140), signals: [{ label: "coordinated_cluster", weight: 1, detail: "71% of likes on 4 posts came from accounts sharing 3 network clusters." }, { label: "engagement_burst", weight: 1, detail: "640 likes landed within 9 minutes of posting." }], evidence: proofLinks("usr_0019"), reports: [] },
    { ...base, id: "susp_0007", userId: "usr_0021", source: "PYTHON_SUGGESTION", modelVersion: "engagement_integrity", status: "PENDING", riskScore: 80, createdAt: isoMinutesAgo(520), signals: [{ label: "reciprocal_pod", weight: 1, detail: "83% of engagers are accounts this creator liked in the last 7 days." }, { label: "new_account_engagement", weight: 1, detail: "41% of engagers joined less than 7 days ago." }], evidence: proofLinks("usr_0021"), reports: [] },
    { ...base, id: "susp_0101", userId: "usr_0012", source: "PYTHON_SUGGESTION", status: "SUSPENDED", riskScore: 94, createdAt: isoMinutesAgo(34 * dayMinutes), signals: [{ label: "Repeated counterfeit listings", weight: 60, detail: "Three removals after two warnings." }], evidence: proofLinks("usr_0012"), reports: [], decision: { outcome: "SUSPENDED", reasonCode: "COUNTERFEIT", reason: "Repeated counterfeit listings after two warnings.", decidedByName: "Tolu Adeyemi", decidedAt: isoMinutesAgo(30 * dayMinutes) }, suspension: { reasonCode: "COUNTERFEIT", suspendedAt: isoMinutesAgo(30 * dayMinutes), suspendedByName: "Tolu Adeyemi" }, appeal: { id: "sapl_0001", status: "PENDING", message: "I sold genuine stock bought from a distributor. I can send the invoices.", submittedAt: isoMinutesAgo(2 * dayMinutes), decisionNote: null } },
    { ...base, id: "susp_0102", userId: "usr_0017", source: "USER_REPORTS", status: "SUSPENDED", riskScore: 88, createdAt: isoMinutesAgo(118 * dayMinutes), signals: [{ label: "Advance-fee pattern", weight: 55, detail: "Buyers paid outside escrow after DMs." }], evidence: proofLinks("usr_0017"), reports: [], decision: { outcome: "SUSPENDED", reasonCode: "FRAUD", reason: "Moved buyers off-platform to collect payment.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(115 * dayMinutes) }, suspension: { reasonCode: "FRAUD", suspendedAt: isoMinutesAgo(115 * dayMinutes), suspendedByName: "Chidi Okafor" } },
    { ...base, id: "susp_0103", userId: "usr_0024", source: "PYTHON_SUGGESTION", status: "SUSPENDED", riskScore: 72, createdAt: isoMinutesAgo(12 * dayMinutes), signals: [{ label: "Spam network", weight: 48, detail: "Linked to 5 accounts already suspended." }], evidence: proofLinks("usr_0024"), reports: [], decision: { outcome: "SUSPENDED", reasonCode: "SPAM_NETWORK", reason: "Member of a coordinated spam network.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(10 * dayMinutes) }, suspension: { reasonCode: "SPAM_NETWORK", suspendedAt: isoMinutesAgo(10 * dayMinutes), suspendedByName: "Chidi Okafor" } },
  ];
}
