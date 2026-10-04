import { findObjectiveOption } from "@/constants/campaignOptions.constant";
import type { AudienceSpec } from "@/types/audience.type";
import type { AdPlacement, BidStrategyType, BudgetLevel, BudgetType, CampaignObjective, PlacementMode } from "@/types/campaign.type";
import type { CallToAction, ContentSource, CreativeFormat, CreativeMedia, CreativeSourceType, CreativeType, CreativeUtm, DestinationType } from "@/types/creative.type";

export interface WizardCardDraft {
  readonly key: string;
  readonly media: CreativeMedia | null;
  readonly headline: string;
  readonly description: string;
  readonly callToAction: CallToAction;
  readonly destinationType: DestinationType;
  readonly destinationUrl: string;
}

export interface WizardAppDraft {
  readonly appName: string;
  readonly iconMedia: CreativeMedia | null;
  readonly ratingText: string;
  readonly iosStoreUrl: string;
  readonly androidStoreUrl: string;
  readonly webFallbackUrl: string;
  readonly iosDeepLink: string;
  readonly androidDeepLink: string;
}

export const emptyAppDraft: WizardAppDraft = { appName: "", iconMedia: null, ratingText: "", iosStoreUrl: "", androidStoreUrl: "", webFallbackUrl: "", iosDeepLink: "", androidDeepLink: "" };

let cardDraftCounter = 0;

export function createEmptyCardDraft(): WizardCardDraft {
  cardDraftCounter += 1;
  return { key: `card-draft-${cardDraftCounter}`, media: null, headline: "", description: "", callToAction: "learn_more", destinationType: "url", destinationUrl: "" };
}

export interface WizardAdDraft {
  readonly creativeType: CreativeType;
  readonly mediaClickable: boolean;
  readonly cards: readonly WizardCardDraft[];
  readonly app: WizardAppDraft;
  readonly utm: CreativeUtm;
  readonly key: string;
  readonly name: string;
  readonly format: CreativeFormat;
  readonly sourceType: CreativeSourceType;
  readonly selectedSource: ContentSource | null;
  readonly uploadedMedia: readonly CreativeMedia[];
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: CallToAction;
  readonly destinationType: DestinationType;
  readonly destinationUrl: string;
}

export interface CampaignWizardState {
  readonly stepIndex: number;
  readonly highestVisitedStepIndex: number;
  readonly objective: CampaignObjective | null;
  readonly campaignName: string;
  readonly budgetLevel: BudgetLevel;
  readonly budgetType: BudgetType;
  readonly budgetAmountText: string;
  readonly spendCapText: string;
  readonly startAtLocal: string;
  readonly endAtLocal: string;
  readonly adSetName: string;
  readonly audience: AudienceSpec;
  readonly placementMode: PlacementMode;
  readonly placements: readonly AdPlacement[];
  readonly bidType: BidStrategyType;
  readonly bidAmountText: string;
  readonly isFrequencyCapEnabled: boolean;
  readonly frequencyImpressionsText: string;
  readonly frequencyPerDaysText: string;
  readonly conversionEventId: string;
  readonly ads: readonly WizardAdDraft[];
  readonly selectedAdKey: string;
}

export type CampaignWizardAction =
  | { readonly type: "go_to_step"; readonly stepIndex: number }
  | { readonly type: "choose_objective"; readonly objective: CampaignObjective }
  | { readonly type: "update_fields"; readonly changes: Partial<Omit<CampaignWizardState, "ads" | "stepIndex" | "highestVisitedStepIndex">> }
  | { readonly type: "add_ad" }
  | { readonly type: "remove_ad"; readonly adKey: string }
  | { readonly type: "select_ad"; readonly adKey: string }
  | { readonly type: "update_ad"; readonly adKey: string; readonly changes: Partial<Omit<WizardAdDraft, "key">> };

let adDraftCounter = 0;

export function formatDateForDateTimeLocalInput(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function buildNextFullHourStart(): string {
  const start = new Date(Date.now() + 60 * 60_000);
  start.setMinutes(0, 0, 0);
  return formatDateForDateTimeLocalInput(start);
}

export function createEmptyAdDraft(objective: CampaignObjective | null, index: number): WizardAdDraft {
  adDraftCounter += 1;
  return {
    key: `ad-draft-${adDraftCounter}`,
    name: `Ad ${index + 1}`,
    creativeType: "single",
    mediaClickable: false,
    cards: [],
    app: emptyAppDraft,
    utm: {},
    format: "feed_post",
    sourceType: "post",
    selectedSource: null,
    uploadedMedia: [],
    headline: "",
    primaryText: "",
    callToAction: objective ? findObjectiveOption(objective).defaultCallToAction : "learn_more",
    destinationType: objective === "messages" ? "messages" : objective === "followers" ? "profile" : objective === "store_promotion" ? "store" : "post",
    destinationUrl: "",
  };
}

export function createInitialWizardState(defaultAudience: AudienceSpec): CampaignWizardState {
  const firstAd = createEmptyAdDraft(null, 0);
  return {
    stepIndex: 0,
    highestVisitedStepIndex: 0,
    objective: null,
    campaignName: "",
    budgetLevel: "campaign",
    budgetType: "daily",
    budgetAmountText: "",
    spendCapText: "",
    startAtLocal: buildNextFullHourStart(),
    endAtLocal: "",
    adSetName: "",
    audience: defaultAudience,
    placementMode: "automatic",
    placements: ["feed", "clips", "mart", "search", "stories", "live"],
    bidType: "auto",
    bidAmountText: "",
    isFrequencyCapEnabled: false,
    frequencyImpressionsText: "3",
    frequencyPerDaysText: "7",
    conversionEventId: "",
    ads: [firstAd],
    selectedAdKey: firstAd.key,
  };
}

export function reduceCampaignWizardState(state: CampaignWizardState, action: CampaignWizardAction): CampaignWizardState {
  switch (action.type) {
    case "go_to_step":
      return { ...state, stepIndex: action.stepIndex, highestVisitedStepIndex: Math.max(state.highestVisitedStepIndex, action.stepIndex) };
    case "choose_objective": {
      const option = findObjectiveOption(action.objective);
      const today = new Date().toLocaleDateString("en-NG", { day: "numeric", month: "short" });
      return {
        ...state,
        objective: action.objective,
        campaignName: state.campaignName || `${option.label} — ${today}`,
        adSetName: state.adSetName || "Ad set 1",
        ads: state.ads.map((ad) => (ad.headline || ad.selectedSource ? ad : { ...createEmptyAdDraft(action.objective, 0), key: ad.key, name: ad.name })),
      };
    }
    case "update_fields":
      return { ...state, ...action.changes };
    case "add_ad": {
      if (state.ads.length >= 6) return state;
      const newAd = createEmptyAdDraft(state.objective, state.ads.length);
      return { ...state, ads: [...state.ads, newAd], selectedAdKey: newAd.key };
    }
    case "remove_ad": {
      if (state.ads.length <= 1) return state;
      const remainingAds = state.ads.filter((ad) => ad.key !== action.adKey);
      return { ...state, ads: remainingAds, selectedAdKey: state.selectedAdKey === action.adKey ? (remainingAds[0]?.key ?? "") : state.selectedAdKey };
    }
    case "select_ad":
      return { ...state, selectedAdKey: action.adKey };
    case "update_ad":
      return { ...state, ads: state.ads.map((ad) => (ad.key === action.adKey ? { ...ad, ...action.changes } : ad)) };
  }
}

export type WizardFieldChanges = Extract<CampaignWizardAction, { type: "update_fields" }>["changes"];
