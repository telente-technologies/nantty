import type { Boost, BoostDestinationType, BoostGoal } from "@/types/boost.type";

export interface BoostGoalOption {
  readonly id: BoostGoal;
  readonly label: string;
  readonly hint: string;
}

export interface BoostDestination {
  readonly type: BoostDestinationType;
  readonly targetId: string;
}

const GOALS_BY_DESTINATION: Record<BoostDestinationType, readonly BoostGoalOption[]> = {
  post: [
    { id: "views", label: "More views", hint: "Show your post to more people" },
    { id: "profile_visits", label: "More profile visits", hint: "Grow your followers" },
    { id: "messages", label: "More messages", hint: "Get people to message you" },
  ],
  profile: [{ id: "profile_visits", label: "More profile visits / followers", hint: "Show your profile to people likely to follow you" }],
  store: [{ id: "store_visits", label: "More store visits", hint: "Bring shoppers to your store page" }],
  product: [{ id: "product_visits", label: "More product views", hint: "Bring shoppers straight to this product" }],
};

const NOUN_BY_DESTINATION: Record<BoostDestinationType, string> = { post: "post", profile: "profile", store: "store", product: "product" };

export const boostGoalsFor = (type: BoostDestinationType): readonly BoostGoalOption[] => GOALS_BY_DESTINATION[type];

export const boostScreenTitleFor = (type: BoostDestinationType): string => `Promote ${NOUN_BY_DESTINATION[type]}`;

export const boostButtonLabelFor = (type: BoostDestinationType): string => (type === "post" ? "Boost post" : `Promote ${NOUN_BY_DESTINATION[type]}`);

export const boostViewTargetLabelFor = (type: BoostDestinationType): string => `View ${NOUN_BY_DESTINATION[type]}`;

export function boostRequestTarget(destination: BoostDestination): { readonly postId?: string; readonly destinationType: BoostDestinationType; readonly targetId: string } {
  return destination.type === "post"
    ? { postId: destination.targetId, destinationType: "post", targetId: destination.targetId }
    : { destinationType: destination.type, targetId: destination.targetId };
}

export function boostDestinationOf(boost: Pick<Boost, "postId" | "destinationType" | "targetId">): BoostDestination {
  const type = boost.destinationType ?? "post";
  return { type, targetId: boost.targetId || boost.postId };
}

export interface BoostResultMetric {
  readonly label: string;
  readonly value: number;
}

export function boostResultMetricsFor(boost: Boost): readonly BoostResultMetric[] {
  const { type } = boostDestinationOf(boost);
  const reach = [
    { label: "Impressions", value: boost.results.impressions },
    { label: "People reached", value: boost.results.reach },
  ];
  if (type === "store") return [...reach, { label: "Store visits (ad taps)", value: boost.results.storeVisits ?? 0 }];
  if (type === "product") return [...reach, { label: "Product views (ad taps)", value: boost.results.productVisits ?? 0 }];
  if (type === "profile") return [...reach, { label: "Profile visits (ad taps)", value: boost.results.profileVisits }];
  return [...reach, { label: "Profile visits", value: boost.results.profileVisits }, { label: "Messages", value: boost.results.messages }];
}
