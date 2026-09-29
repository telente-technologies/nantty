import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";
import { isoMinutesAgo } from "@/mocks/seed/trustTime.mock";
import type { AppealDetail, AppealSummary } from "@/types/moderation.type";

export interface MockAppealRecord extends Omit<AppealSummary, "appellant" | "status" | "target"> {
  appellantUserId: string;
  status: AppealSummary["status"];
  target: AppealSummary["target"];
  decision: AppealDetail["decision"];
  strikeWasIssued: boolean;
}

const image = (photoId: string) => buildUnsplashImageUrl(photoId, 480);

export function buildDemoTrustAppeals(): MockAppealRecord[] {
  return [
    {
      id: "apl_0001", appellantUserId: "usr_0012", decisionType: "SUSPENSION", strikeWasIssued: true,
      originalDecision: { action: "SUSPEND_AUTHOR", reason: "Repeated counterfeit listings after two warnings.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(2900), reportId: "rpt_0012" },
      target: { type: "USER", id: "usr_0012", title: "@dayo_deals", text: "Account suspended for 7 days.", mediaUrls: [], soundTitle: null, visibility: "RESTRICTED", createdAt: isoMinutesAgo(172_800) },
      userStatement: "I sell original products from Dubai. The watch clip was a joke caption. I have receipts for my stock and 2,000 happy customers. Please restore my shop, it is my only income.",
      evidenceNotes: ["Uploaded 3 supplier invoices (Dubai Duty Free, dated August)", "Screenshot of 4.8★ seller rating"],
      status: "PENDING", submittedAt: isoMinutesAgo(600), slaDueAt: isoMinutesAgo(600 - 2880),
      decision: null,
    },
    {
      id: "apl_0002", appellantUserId: "usr_0016", decisionType: "CONTENT_REMOVED", strikeWasIssued: false,
      originalDecision: { action: "REMOVE", reason: "Graphic violence without context.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(1300), reportId: null },
      target: { type: "CLIP", id: "clp_39950", title: "Area boys vs LASTMA — what really happened", text: "Documenting what happened at Ikorodu Road so people know the truth.", mediaUrls: [image(unsplashPhotoIds.posts.lagosSkyline[0])], soundTitle: "Original sound — bolu.films", visibility: "REMOVED", createdAt: isoMinutesAgo(2000) },
      userStatement: "This is citizen journalism. I blurred faces and added a warning screen. News channels showed the same footage.",
      evidenceNotes: ["Link to Channels TV report on the same incident", "Clip has a sensitive-content warning at 0:00"],
      status: "PENDING", submittedAt: isoMinutesAgo(240), slaDueAt: isoMinutesAgo(240 - 2880),
      decision: null,
    },
    {
      id: "apl_0003", appellantUserId: "usr_0023", decisionType: "STRIKE", strikeWasIssued: true,
      originalDecision: { action: "WARN_AUTHOR", reason: "Listing described as 'first copy' (replica).", decidedByName: "Ngozi Eze", decidedAt: isoMinutesAgo(4300), reportId: null },
      target: { type: "PRODUCT", id: "prd_87002", title: "Air Force 1 '07 — first grade", text: "First grade quality, comes with box.", mediaUrls: [image(unsplashPhotoIds.products.s1[0])], soundTitle: null, visibility: "HIDDEN", createdAt: isoMinutesAgo(9000) },
      userStatement: "First grade means brand new, not fake. I buy from authorised distributors in Aba.",
      evidenceNotes: [],
      status: "PENDING", submittedAt: isoMinutesAgo(3200), slaDueAt: isoMinutesAgo(3200 - 2880),
      decision: null,
    },
    {
      id: "apl_0004", appellantUserId: "usr_0011", decisionType: "CONTENT_RESTRICTED", strikeWasIssued: false,
      originalDecision: { action: "RESTRICT", reason: "Nudity classifier flagged image.", decidedByName: "System", decidedAt: isoMinutesAgo(9000), reportId: null },
      target: { type: "POST", id: "pst_19002", title: null, text: "Study in charcoal, 2026.", mediaUrls: [image(unsplashPhotoIds.posts.plantsBalcony[0])], soundTitle: null, visibility: "VISIBLE", createdAt: isoMinutesAgo(9500) },
      userStatement: "It is a fine-art drawing, not explicit.",
      evidenceNotes: [],
      status: "OVERTURNED", submittedAt: isoMinutesAgo(8800), slaDueAt: isoMinutesAgo(8800 - 2880),
      decision: { outcome: "OVERTURNED", reason: "Artistic nudity allowed under community guidelines 4.2.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(8000) },
    },
  ];
}
