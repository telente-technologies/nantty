import { appendMockActivity, readMockDatabase, type MockAdRecord } from "@/mocks/mockDatabase.mock";

const reviewDelayInMilliseconds = 15_000;
const appealDelayInMilliseconds = 30_000;

const policyScanners: readonly { readonly pattern: RegExp; readonly code: string; readonly reason: string }[] = [
  { pattern: /first\s*copy|replica|master\s*copy|\bclone\b/i, code: "counterfeit", reason: "The ad presents products as replicas of a branded product. Remove the replica wording, or show only products you have the right to sell." },
  { pattern: /double your money|guaranteed (returns|profit)|get rich/i, code: "financial_scams", reason: "The ad promises guaranteed or unrealistic financial returns." },
  { pattern: /\bcures?\b|miracle|lose \d+\s?kg in/i, code: "misleading_claims", reason: "The ad makes a health claim that cannot be verified." },
  { pattern: /\b(vape|shisha|e-?cig)/i, code: "tobacco_vaping", reason: "Tobacco and vaping products cannot be advertised." },
  { pattern: /\bare you (hiv|pregnant|broke|in debt)/i, code: "personal_attributes", reason: "The ad implies it knows a private personal attribute of the viewer." },
];

const blockedDestinationDomains: readonly string[] = ["malware.example", "phishing.example"];
const linkShorteners: readonly string[] = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rb.gy"];

function collectDestinationUrls(ad: MockAdRecord): string[] {
  const { creative } = ad;
  const urls = [creative.destination.url, ...(creative.cards ?? []).map((card) => card.destination.url), creative.app?.webFallbackUrl];
  return urls.filter((url): url is string => Boolean(url));
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function scanDestinationsForPolicyViolation(ad: MockAdRecord): { code: string; reason: string } | null {
  for (const rawUrl of collectDestinationUrls(ad)) {
    let host = "";
    try {
      host = new URL(rawUrl).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (blockedDestinationDomains.some((domain) => matchesDomain(host, domain))) return { code: "malicious_destination", reason: `The link to ${host} is on the blocked list. Use a destination you own.` };
    if (linkShorteners.some((domain) => matchesDomain(host, domain)) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { code: "malicious_destination", reason: "Shortened links and raw IP addresses hide the real destination. Use the full link." };
  }
  return null;
}

export function scanCreativeTextForPolicyViolation(ad: MockAdRecord): { code: string; reason: string } | null {
  const cardText = (ad.creative.cards ?? []).map((card) => `${card.headline} ${card.description}`).join(" ");
  const text = `${ad.creative.headline} ${ad.creative.primaryText} ${cardText} ${ad.creative.app?.appName ?? ""}`;
  const match = policyScanners.find((scanner) => scanner.pattern.test(text));
  return match ? { code: match.code, reason: match.reason } : scanDestinationsForPolicyViolation(ad);
}

function refreshParentStatusesAfterReview(ad: MockAdRecord): void {
  const database = readMockDatabase();
  const adSet = database.adSets.find((candidate) => candidate.id === ad.adSetId);
  const campaign = database.campaigns.find((candidate) => candidate.id === ad.campaignId);
  if (!adSet || !campaign) return;
  const siblingAds = database.ads.filter((candidate) => candidate.campaignId === campaign.id);
  if (siblingAds.some((candidate) => candidate.status === "in_review")) return;
  const hasApprovedAd = siblingAds.some((candidate) => candidate.review.status === "approved");
  const nextStatus = hasApprovedAd ? "active" : "rejected";
  if (campaign.status === "in_review" || campaign.status === "rejected") campaign.status = nextStatus;
  for (const siblingAdSet of database.adSets.filter((candidate) => candidate.campaignId === campaign.id)) {
    if (siblingAdSet.status === "in_review" || siblingAdSet.status === "rejected") {
      const adSetHasApproved = siblingAds.some((candidate) => candidate.adSetId === siblingAdSet.id && candidate.review.status === "approved");
      siblingAdSet.status = adSetHasApproved ? "active" : "rejected";
    }
  }
}

export function advanceMockReviewQueue(): void {
  const database = readMockDatabase();
  const now = Date.now();
  for (const ad of database.ads) {
    if (ad.status === "in_review" && ad.submittedAt && now - Date.parse(ad.submittedAt) > reviewDelayInMilliseconds) {
      const violation = scanCreativeTextForPolicyViolation(ad);
      ad.review = violation
        ? { status: "rejected", policyCode: violation.code, policyReason: violation.reason, reviewedAt: new Date().toISOString(), appeal: null }
        : { status: "approved", policyCode: null, policyReason: null, reviewedAt: new Date().toISOString(), appeal: null };
      ad.status = violation ? "rejected" : "active";
      ad.submittedAt = null;
      appendMockActivity(ad.accountId, {
        actor: { id: "system", name: "Zudomart review", isSystem: true },
        action: violation ? "ad_rejected" : "ad_approved",
        objectType: "ad",
        objectId: ad.id,
        objectName: ad.name,
        summary: violation ? `Ad rejected: ${violation.code.replace(/_/g, " ")} policy` : "Ad approved and delivering",
        changes: [{ field: "Review", from: "Pending", to: violation ? "Rejected" : "Approved" }],
      });
      refreshParentStatusesAfterReview(ad);
    }
    const appeal = ad.review.appeal;
    if (appeal?.status === "pending" && now - Date.parse(appeal.submittedAt) > appealDelayInMilliseconds) {
      const stillViolates = scanCreativeTextForPolicyViolation(ad) !== null;
      ad.review = {
        ...ad.review,
        status: stillViolates ? "rejected" : "approved",
        appeal: {
          ...appeal,
          status: stillViolates ? "upheld" : "overturned",
          resolvedAt: new Date().toISOString(),
          resolutionNote: stillViolates ? "A reviewer checked the ad again and the original decision stands. Edit the ad to remove the flagged wording and it will be reviewed again." : "A reviewer checked the ad again and approved it.",
        },
      };
      if (!stillViolates) ad.status = "active";
      refreshParentStatusesAfterReview(ad);
    }
  }
}

export function markAdAsSubmittedForReview(ad: MockAdRecord): void {
  ad.status = "in_review";
  ad.submittedAt = new Date().toISOString();
  ad.review = { status: "pending", policyCode: null, policyReason: null, reviewedAt: null, appeal: null };
}
