import type { LiveAdPlacement, LiveMonetizationInput } from "@/types/socialGraph.type";

export const LIVE_AD_TERMS_VERSION = "2026-10";

export const LIVE_AD_TERMS_SUMMARY = [
  "Nantty may show ads in this live only in the places you choose.",
  "Ads never run more often than your limits, and viewers can see an ad indicator if you keep it on.",
  "Revenue is shared under the monetization policy that applies when the ad is delivered.",
  "You stay responsible for your own sponsorship mentions. Nantty does not sell them.",
] as const;

export const LIVE_AD_PLACEMENT_OPTIONS: readonly { readonly key: LiveAdPlacement; readonly label: string }[] = [
  { key: "beforeJoin", label: "Before viewers join" },
  { key: "naturalBreak", label: "Natural breaks" },
  { key: "betweenSegments", label: "Between segments" },
  { key: "overlay", label: "Overlay" },
  { key: "end", label: "At the end" },
];

export const LIVE_AD_MIN_INTERVAL_OPTIONS_MINUTES = [5, 10, 15, 30] as const;
export const LIVE_AD_MAX_INTERRUPTIONS = 3;

export interface LiveMonetizationDraft {
  readonly allowAds: boolean;
  readonly placements: readonly LiveAdPlacement[];
  readonly maxInterruptions: number;
  readonly minIntervalMinutes: number;
  readonly showAdIndicator: boolean;
  readonly agreedToTerms: boolean;
  readonly sponsorshipLine: string;
}

export const DEFAULT_LIVE_MONETIZATION_DRAFT: LiveMonetizationDraft = {
  allowAds: false,
  placements: ["naturalBreak"],
  maxInterruptions: 1,
  minIntervalMinutes: 10,
  showAdIndicator: true,
  agreedToTerms: false,
  sponsorshipLine: "",
};

export const isLiveAdAcceptanceInEffect = (draft: LiveMonetizationDraft) => draft.allowAds && draft.agreedToTerms;

export function buildLiveMonetizationInput(draft: LiveMonetizationDraft): LiveMonetizationInput {
  const isAccepted = isLiveAdAcceptanceInEffect(draft);
  const sponsorshipLine = draft.sponsorshipLine.trim();
  return {
    liveAdSettings: {
      allowAds: isAccepted,
      placements: isAccepted ? draft.placements : [],
      maxInterruptions: isAccepted ? draft.maxInterruptions : 0,
      minIntervalMinutes: draft.minIntervalMinutes,
      showAdIndicator: draft.showAdIndicator,
      acceptedTermsVersion: isAccepted ? LIVE_AD_TERMS_VERSION : null,
      acceptedAt: isAccepted ? new Date().toISOString() : null,
    },
    acceptedLiveAdTermsVersion: isAccepted ? LIVE_AD_TERMS_VERSION : null,
    sponsorshipLine: sponsorshipLine.length > 0 ? sponsorshipLine : null,
  };
}
