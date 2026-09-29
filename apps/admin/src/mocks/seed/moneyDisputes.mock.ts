import type { MockDisputeRecord, MockRefundRecord } from "@/mocks/handlers/money/moneyRecords.mock";
import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";

function isoHoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

const photo = (photoId: string) => buildUnsplashImageUrl(photoId, 480);

export function buildDemoDisputes(): MockDisputeRecord[] {
  return [
    {
      id: "dsp_0001", orderId: "ord_0001", reasonCategory: "NOT_AS_DESCRIBED", priority: "NORMAL", openedAt: isoHoursFromNow(-100), slaDueAt: isoHoursFromNow(20), status: "IN_REVIEW",
      buyerClaim: "The set came in a lighter blue than the photos and the trouser hem is unfinished on one leg. I still want to keep the top but not at full price.",
      sellerResponse: "The dye is hand-done so shades vary, that is in the listing. I can accept a partial refund for the hem issue but not a full refund.",
      evidence: [
        { id: "evd_1", imageUrl: photo(unsplashPhotoIds.products.f1[0]), caption: "Listing photo the buyer ordered from", submittedBy: "SELLER" },
        { id: "evd_2", imageUrl: photo(unsplashPhotoIds.products.f1[1]), caption: "Item as received, daylight", submittedBy: "BUYER" },
        { id: "evd_3", imageUrl: photo(unsplashPhotoIds.products.f1[2]), caption: "Unfinished hem on left leg", submittedBy: "BUYER" },
      ],
      messages: [
        { id: "msg_1", authorName: "Tunde Eats", authorRole: "BUYER", body: "Hem is coming apart on the left leg, see photo 3.", sentAt: isoHoursFromNow(-99) },
        { id: "msg_2", authorName: "Adaeze Styles", authorRole: "SELLER", body: "Sorry about the hem. The colour difference is normal for adire. I can refund ₦12,000 for the repair.", sentAt: isoHoursFromNow(-80) },
        { id: "msg_3", authorName: "Tunde Eats", authorRole: "BUYER", body: "₦12k is not enough, tailor quoted more and the colour is off.", sentAt: isoHoursFromNow(-70) },
      ],
      resolution: null,
    },
    {
      id: "dsp_0002", orderId: "ord_0003", reasonCategory: "NOT_RECEIVED", priority: "URGENT", openedAt: isoHoursFromNow(-160), slaDueAt: isoHoursFromNow(-16), status: "OPEN",
      buyerClaim: "Tracking says delivered but nothing arrived at my address. Nobody at the gate signed for it.",
      sellerResponse: "Courier shows delivered with a signature. Buyer should check with security.",
      evidence: [{ id: "evd_4", imageUrl: photo(unsplashPhotoIds.products.g6[0]), caption: "Product listing", submittedBy: "SELLER" }],
      messages: [{ id: "msg_4", authorName: "Ifeoma Art", authorRole: "BUYER", body: "Estate security has no record of any GIG rider that day.", sentAt: isoHoursFromNow(-150) }],
      resolution: null,
    },
    {
      id: "dsp_0003", orderId: "ord_0007", reasonCategory: "DAMAGED", priority: "HIGH", openedAt: isoHoursFromNow(-40), slaDueAt: isoHoursFromNow(8), status: "AWAITING_SELLER",
      buyerClaim: "The stole arrived with a tear along the fringe.",
      sellerResponse: null,
      evidence: [{ id: "evd_5", imageUrl: photo(unsplashPhotoIds.products.f3[1]), caption: "Tear on fringe", submittedBy: "BUYER" }],
      messages: [],
      resolution: null,
    },
    {
      id: "dsp_0004", orderId: "ord_0012", reasonCategory: "WRONG_ITEM", priority: "NORMAL", openedAt: isoHoursFromNow(-120), slaDueAt: isoHoursFromNow(-2), status: "IN_REVIEW",
      buyerClaim: "Ordered four mud-cloth pillows, received two mud-cloth and two plain grey.",
      sellerResponse: "Two designs sold out after the order, I messaged the buyer before sending replacements.",
      evidence: [{ id: "evd_6", imageUrl: photo(unsplashPhotoIds.products.h4[1]), caption: "Two plain pillows received", submittedBy: "BUYER" }],
      messages: [{ id: "msg_5", authorName: "Grace Decor", authorRole: "SELLER", body: "Screenshot of my message attached in chat history.", sentAt: isoHoursFromNow(-110) }],
      resolution: null,
    },
    {
      id: "dsp_0005", orderId: "ord_0014", reasonCategory: "NOT_AS_DESCRIBED", priority: "NORMAL", openedAt: isoHoursFromNow(-460), slaDueAt: isoHoursFromNow(-380), status: "RESOLVED",
      buyerClaim: "Gown length is shorter than the size chart.",
      sellerResponse: "Agreed to refund part for alteration.",
      evidence: [],
      messages: [],
      resolution: { outcome: "REFUND_PARTIAL", buyerRefundMinor: 12_000_00, sellerPayoutMinor: 20_460_00, commissionMinor: 1_540_00, reason: "Both parties accepted ₦12,000 for alteration.", resolvedAt: isoHoursFromNow(-410), resolvedByName: "Chidi Okafor" },
    },
  ];
}

export function buildDemoRefunds(): MockRefundRecord[] {
  return [
    { id: "rfd_0001", orderId: "ord_0010", amountMinor: 56_500_00, currency: "NGN", source: "MANUAL", reason: "Courier confirmed the parcel was lost in transit.", createdAt: isoHoursFromNow(-340), createdByName: "Chidi Okafor", status: "COMPLETED" },
    { id: "rfd_0002", orderId: "ord_0014", amountMinor: 12_000_00, currency: "NGN", source: "DISPUTE", reason: "Both parties accepted ₦12,000 for alteration.", createdAt: isoHoursFromNow(-410), createdByName: "Chidi Okafor", status: "COMPLETED" },
  ];
}
