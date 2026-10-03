import type { CheckmarkSuggestion } from "@/types/trust.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { accountAgeInDaysForSignedInUser, trustStatsForSignedInUser } from "./trustStats.mock";

const dismissedColorsByUserId = new Map<string, Set<string>>();

const buildBlueSuggestion = (dismissed: boolean): CheckmarkSuggestion => {
  const stats = trustStatsForSignedInUser();
  const rules = [
    { label: "ID verified", met: stats.idVerified },
    { label: "Account at least 90 days old", met: accountAgeInDaysForSignedInUser() >= 90 },
    { label: "1,000 or more real followers", met: stats.realFollowers >= 1000 },
    { label: "No recent violations", met: stats.violationsLast90Days === 0 },
  ];
  const hasVerification = getSignedInMockUser().verification?.status === "active";
  return {
    color: "blue", dismissed, rules, eligible: !hasVerification && rules.every((rule) => rule.met),
    headline: "You may qualify for a verified checkmark",
    detail: "A Blue checkmark shows people it's really you. Apply in a few minutes.",
  };
};

const buildGoldSuggestion = (dismissed: boolean): CheckmarkSuggestion => {
  const stats = trustStatsForSignedInUser();
  const rules = [
    { label: "Business verification passed", met: stats.businessVerified },
    { label: "Active store or brand", met: stats.hasActiveStore },
    { label: "Good order success rate", met: stats.successRatePercent >= 90 },
  ];
  const hasGold = getSignedInMockUser().verification?.color === "gold" && getSignedInMockUser().verification?.status === "active";
  return {
    color: "gold", dismissed, rules, eligible: !hasGold && rules.every((rule) => rule.met),
    headline: "Your business may qualify for a Gold checkmark",
    detail: "Gold also comes with the Pro and Business plans once your business is verified.",
  };
};

export const checkmarkSuggestionMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/verification/suggestions", (): CheckmarkSuggestion[] => {
    const dismissed = dismissedColorsByUserId.get(getSignedInMockUser().id) ?? new Set<string>();
    return [buildBlueSuggestion(dismissed.has("blue")), buildGoldSuggestion(dismissed.has("gold"))];
  }),
  createMockRoute("POST", "/api/v1/verification/suggestions/:color/dismiss", ({ params }) => {
    const userId = getSignedInMockUser().id;
    dismissedColorsByUserId.set(userId, new Set([...(dismissedColorsByUserId.get(userId) ?? []), params.color!]));
  }),
];
