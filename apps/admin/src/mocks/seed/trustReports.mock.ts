import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";
import { isoMinutesAgo, reportSlaMinutesByPriority } from "@/mocks/seed/trustTime.mock";
import type { ClassifierScore, ModeratedTargetPreview, ModerationDecision, ReportPriority, ReportReason, ReportReasonCount, ReportStatus, ReporterNote } from "@/types/moderation.type";

export interface MockReportRecord {
  id: string;
  target: ModeratedTargetPreview;
  authorUserId: string;
  primaryReason: ReportReason;
  reasonCounts: ReportReasonCount[];
  priority: ReportPriority;
  status: ReportStatus;
  firstReportedAt: string;
  lastReportedAt: string;
  slaDueAt: string;
  reporterNotes: ReporterNote[];
  classifierScores: ClassifierScore[];
  decision: ModerationDecision | null;
}

const image = (photoId: string) => buildUnsplashImageUrl(photoId, 480);

interface ReportSeedRow {
  readonly target: Omit<ModeratedTargetPreview, "createdAt" | "visibility"> & { readonly visibility?: ModeratedTargetPreview["visibility"] };
  readonly authorUserId: string;
  readonly reasons: readonly [ReportReason, number][];
  readonly priority: ReportPriority;
  readonly status?: ReportStatus;
  readonly firstReportedMinutesAgo: number;
  readonly notes: readonly [string, string][];
  readonly scores: readonly [string, number][];
  readonly decision?: ModerationDecision;
}

const seedRows: readonly ReportSeedRow[] = [
  {
    target: { type: "PRODUCT", id: "prd_88412", title: "iPhone 15 Pro Max 256GB — 100% original UK used", text: "No box, no receipt. Pay deposit first and I send. ₦380k last price.", mediaUrls: [image(unsplashPhotoIds.products.g7[0])], soundTitle: null },
    authorUserId: "usr_0005", reasons: [["COUNTERFEIT", 11], ["SCAM", 3]], priority: "HIGH", firstReportedMinutesAgo: 310,
    notes: [["kemi.kitchen", "Serial number on the photo belongs to a phone reported stolen."], ["obinna.tech", "Price is far below market and asks for deposit outside escrow."]],
    scores: [["counterfeit", 0.87], ["scam", 0.64], ["spam", 0.12]],
  },
  {
    target: { type: "POST", id: "pst_20931", title: null, text: "Yeezy 350 first copy 🔥 same as original, nobody go know. DM for bulk price.", mediaUrls: [image(unsplashPhotoIds.products.s2[0]), image(unsplashPhotoIds.products.s2[1])], soundTitle: null },
    authorUserId: "usr_0023", reasons: [["COUNTERFEIT", 6]], priority: "HIGH", firstReportedMinutesAgo: 190,
    notes: [["funke.naturals", "Seller says 'first copy' which means replica."]],
    scores: [["counterfeit", 0.93], ["spam", 0.21]],
  },
  {
    target: { type: "LIVE", id: "liv_5521", title: "Double your money in 24 hours — live proof", text: "Send ₦50k, receive ₦100k tomorrow. Only 10 slots left.", mediaUrls: [image(unsplashPhotoIds.posts.laptopDesk[0])], soundTitle: null },
    authorUserId: "usr_0012", reasons: [["SCAM", 22], ["MISINFORMATION", 4]], priority: "URGENT", firstReportedMinutesAgo: 75,
    notes: [["tunde_eats", "He is taking money from viewers in the chat right now."], ["zainab.glow", "Classic Ponzi pitch."]],
    scores: [["scam", 0.96], ["financial_fraud", 0.91]],
  },
  {
    target: { type: "COMMENT", id: "cmt_77120", title: null, text: "Nobody wants to see your ugly face, delete your account before we do it for you.", mediaUrls: [], soundTitle: null },
    authorUserId: "usr_0018", reasons: [["HARASSMENT", 5], ["HATE", 1]], priority: "NORMAL", firstReportedMinutesAgo: 420,
    notes: [["zainab.glow", "This person comments on all my posts."]],
    scores: [["harassment", 0.89], ["threat", 0.58], ["hate", 0.22]],
  },
  {
    target: { type: "CLIP", id: "clp_40091", title: "Wahala at Oshodi under bridge", text: "See as dem dey fight 😂", mediaUrls: [image(unsplashPhotoIds.posts.streetMarket[0])], soundTitle: "Original sound — bolu.films" },
    authorUserId: "usr_0016", reasons: [["VIOLENCE", 9]], priority: "HIGH", firstReportedMinutesAgo: 260,
    notes: [["amara.reads", "Graphic fight, a man is bleeding."]],
    scores: [["graphic_violence", 0.78], ["blood", 0.61]],
  },
  {
    target: { type: "USER", id: "usr_0027", title: "@ken.otieno", text: "Bio: Official backup account of Tunde Eats. Send your food orders here.", mediaUrls: [], soundTitle: null },
    authorUserId: "usr_0027", reasons: [["IMPERSONATION", 4]], priority: "NORMAL", firstReportedMinutesAgo: 900,
    notes: [["tunde_eats", "This is not me. I have only one account."]],
    scores: [["impersonation", 0.82]],
  },
  {
    target: { type: "MESSAGE", id: "msg_993120", title: "Direct message to @ngozi_bakes", text: "Pay the ₦150k deposit to my Opay so we avoid Nantty charges. I deliver tomorrow.", mediaUrls: [], soundTitle: null },
    authorUserId: "usr_0014", reasons: [["SCAM", 2]], priority: "HIGH", firstReportedMinutesAgo: 130,
    notes: [["ngozi_bakes", "Asked me to pay outside the app."]],
    scores: [["off_platform_payment", 0.91], ["scam", 0.7]],
  },
  {
    target: { type: "POST", id: "pst_20877", title: null, text: "Drinking hot water with lime every morning cures typhoid in 3 days. My family stopped hospital.", mediaUrls: [image(unsplashPhotoIds.posts.booksCoffee[0])], soundTitle: null },
    authorUserId: "usr_0022", reasons: [["MISINFORMATION", 3]], priority: "LOW", firstReportedMinutesAgo: 2600,
    notes: [["obinna.tech", "Dangerous health advice."]],
    scores: [["health_misinformation", 0.74]],
  },
  {
    target: { type: "POST", id: "pst_21004", title: null, text: "New piece: 'Mother and child', charcoal on paper.", mediaUrls: [image(unsplashPhotoIds.posts.plantsBalcony[0])], soundTitle: null },
    authorUserId: "usr_0011", reasons: [["NUDITY", 2]], priority: "NORMAL", firstReportedMinutesAgo: 700,
    notes: [["segun.snaps", "Nudity."]],
    scores: [["nudity", 0.41], ["artistic", 0.83]],
  },
  {
    target: { type: "COMMENT", id: "cmt_77301", title: null, text: "Check my page for cheap followers 10k for ₦5000!!! 🔥🔥", mediaUrls: [], soundTitle: null },
    authorUserId: "usr_0026", reasons: [["SPAM", 7]], priority: "LOW", firstReportedMinutesAgo: 1500,
    notes: [], scores: [["spam", 0.97]],
  },
  {
    target: { type: "PRODUCT", id: "prd_88300", title: "Chiffon hijab set — 5 colours", text: "Premium chiffon, soft and breathable.", mediaUrls: [image(unsplashPhotoIds.products.f3[0])], soundTitle: null },
    authorUserId: "usr_0019", reasons: [["OTHER", 1]], priority: "LOW", status: "DISMISSED", firstReportedMinutesAgo: 5000,
    notes: [["musa.motors", "Wrong category."]], scores: [["spam", 0.04]],
    decision: { action: "DISMISS", reason: "Listing follows policy; category issue is not a violation.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(4800), suspensionDays: null },
  },
  {
    target: { type: "CLIP", id: "clp_40002", title: "Cheap Rolex in Balogun", text: "AAA copy Rolex, looks real", mediaUrls: [image(unsplashPhotoIds.products.g1[0])], soundTitle: "Original sound — dayo_deals", visibility: "REMOVED" },
    authorUserId: "usr_0012", reasons: [["COUNTERFEIT", 8]], priority: "HIGH", status: "RESOLVED", firstReportedMinutesAgo: 8000,
    notes: [], scores: [["counterfeit", 0.95]],
    decision: { action: "REMOVE", reason: "Sale of replica luxury watches.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(7600), suspensionDays: null },
  },
];

export function buildDemoTrustReports(): MockReportRecord[] {
  return seedRows.map((row, index) => {
    const reasonCounts = row.reasons.map(([reason, count]) => ({ reason, count }));
    const firstReportedAt = isoMinutesAgo(row.firstReportedMinutesAgo);
    return {
      id: `rpt_${String(index + 1).padStart(4, "0")}`,
      target: { ...row.target, visibility: row.target.visibility ?? "VISIBLE", createdAt: isoMinutesAgo(row.firstReportedMinutesAgo + 600) },
      authorUserId: row.authorUserId,
      primaryReason: row.reasons[0]?.[0] ?? "OTHER",
      reasonCounts,
      priority: row.priority,
      status: row.status ?? "OPEN",
      firstReportedAt,
      lastReportedAt: isoMinutesAgo(Math.max(3, Math.round(row.firstReportedMinutesAgo / 4))),
      slaDueAt: isoMinutesAgo(row.firstReportedMinutesAgo - reportSlaMinutesByPriority[row.priority]),
      reporterNotes: row.notes.map(([reporterUsername, note], noteIndex) => ({ reporterUsername, note, reportedAt: isoMinutesAgo(row.firstReportedMinutesAgo - noteIndex * 17) })),
      classifierScores: row.scores.map(([label, score]) => ({ label, score })),
      decision: row.decision ?? null,
    };
  });
}
