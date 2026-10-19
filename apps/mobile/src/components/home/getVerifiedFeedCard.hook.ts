import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { verificationQueryKeys } from "@/components/profile/verificationQueries.hook";
import { useActingProfileType } from "@/hooks/useActingProfileType.hook";
import { verificationService } from "@/services/auth/verification.service";
import { useActingProfileStore } from "@/store/actingProfile.store";
import { useAuthStore } from "@/store/auth.store";
import { useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import { showToast } from "@/store/toast.store";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { canShowGetVerifiedCard, emptyGetVerifiedCardHistory, offerIdsNotYetSurfaced } from "@/utils/getVerifiedCardFrequency.util";
import { describeGetVerifiedDiscount, pickGetVerifiedDiscountHighlight, resolveGetVerifiedCardState, type GetVerifiedCardState } from "@/utils/getVerifiedCardState.util";
import type { CurrencyCode } from "@/types/money.type";

const sessionDecisionByViewer = new Map<string, boolean>();
const sessionDismissedViewers = new Set<string>();
export const verificationDiscountsQueryKey = ["verification", "discounts"] as const;

function usePreferencesHydrated() {
  const [hydrated, setHydrated] = useState(() => useFeedModulePreferencesStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useFeedModulePreferencesStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}

export function useGetVerifiedFeedCard() {
  const navigation = useNavigation();
  const viewerId = useAuthStore((state) => (state.status === "signedIn" ? state.user?.id ?? null : null));
  const viewerUser = useAuthStore((state) => state.user);
  const actingProfile = useActingProfileStore((state) => state.actingProfile);
  const { type: profileType } = useActingProfileType();
  const hydrated = usePreferencesHydrated();
  const history = useFeedModulePreferencesStore((state) => (viewerId ? state.getVerifiedHistoryByViewer[viewerId] : undefined)) ?? emptyGetVerifiedCardHistory;
  const preferences = useFeedModulePreferencesStore.getState();
  const [, forceRender] = useState(0);
  const signedIn = viewerId !== null;

  const myVerification = useQuery({ queryKey: verificationQueryKeys.mine, queryFn: verificationService.fetchMyVerification, enabled: signedIn, staleTime: 300_000 });
  const suggestions = useQuery({ queryKey: verificationQueryKeys.suggestions, queryFn: verificationService.listCheckmarkSuggestions, enabled: signedIn, staleTime: 300_000 });
  const state: GetVerifiedCardState = useMemo(() => {
    if (!signedIn || suggestions.isPending) return { kind: "hidden" };
    const color = profileType === "personal" ? "blue" : "gold";
    const dismissedOnServer = (suggestions.data ?? []).some((suggestion) => suggestion.color === color && suggestion.dismissed);
    return resolveGetVerifiedCardState({ profileType, myVerification: myVerification.data, dismissedOnServer });
  }, [signedIn, suggestions.isPending, suggestions.data, profileType, myVerification.data]);
  const discounts = useQuery({ queryKey: verificationDiscountsQueryKey, queryFn: verificationService.fetchVerificationDiscounts, enabled: signedIn && state.kind === "offer", staleTime: 600_000 });
  const highlight = state.kind === "offer" ? pickGetVerifiedDiscountHighlight(discounts.data, state.color) : null;
  const discountLine = highlight ? describeGetVerifiedDiscount(highlight, (amountMinor, currency) => formatMoneyForDisplay({ amountMinor, currency: currency as CurrencyCode }, { showDecimals: false })) : null;

  if (viewerId && hydrated && !sessionDecisionByViewer.has(viewerId)) sessionDecisionByViewer.set(viewerId, canShowGetVerifiedCard(history, Date.now()));
  const decidedToShow = viewerId !== null && sessionDecisionByViewer.get(viewerId) === true && !sessionDismissedViewers.has(viewerId);
  const visible = decidedToShow && state.kind !== "hidden";

  useEffect(() => {
    if (!viewerId || !hydrated || visible || history.neverShowAgain || highlight?.kind !== "offerLink") return;
    if (offerIdsNotYetSurfaced(history, [highlight.offer.linkId]).length === 0) return;
    preferences.markDiscountOffersSurfaced(viewerId, [highlight.offer.linkId]);
    const token = highlight.offer.token;
    showToast(discountLine ?? "You have a verification offer waiting.", { action: { label: "View", onPress: () => navigation.navigate("SubscriptionOffer", { token }) } });
  }, [viewerId, hydrated, visible, history, highlight, discountLine, navigation, preferences]);

  const hideForThisSession = useCallback(() => {
    if (viewerId) sessionDismissedViewers.add(viewerId);
    forceRender((value) => value + 1);
  }, [viewerId]);

  const recordImpression = useCallback(() => {
    if (!viewerId) return;
    preferences.recordGetVerifiedImpression(viewerId);
    if (highlight?.kind === "offerLink") preferences.markDiscountOffersSurfaced(viewerId, [highlight.offer.linkId]);
  }, [viewerId, preferences, highlight]);

  const dismiss = useCallback(() => {
    if (viewerId) preferences.dismissGetVerifiedCard(viewerId);
    hideForThisSession();
  }, [viewerId, preferences, hideForThisSession]);

  const neverShowAgain = useCallback(() => {
    if (!viewerId) return;
    preferences.neverShowGetVerifiedCard(viewerId);
    if (state.kind !== "hidden") void verificationService.dismissCheckmarkSuggestion(state.color).catch(() => undefined);
    hideForThisSession();
  }, [viewerId, preferences, state, hideForThisSession]);

  const openVerificationFlow = useCallback(() => {
    if (highlight?.kind === "offerLink") return navigation.navigate("SubscriptionOffer", { token: highlight.offer.token });
    navigation.navigate("Verification");
  }, [highlight, navigation]);

  return {
    visible,
    state,
    discountLine,
    hasPersonalOffer: highlight?.kind === "offerLink",
    viewerName: actingProfile?.name ?? viewerUser?.name ?? "",
    viewerAvatarUrl: actingProfile?.avatarUrl ?? viewerUser?.avatarUrl ?? null,
    profileType,
    recordImpression,
    dismiss,
    neverShowAgain,
    openVerificationFlow,
  };
}

export type GetVerifiedFeedCardModel = ReturnType<typeof useGetVerifiedFeedCard>;

export function resetGetVerifiedSessionForTests() {
  sessionDecisionByViewer.clear();
  sessionDismissedViewers.clear();
}
