"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { showToast } from "@/components/ui/toast";
import { verificationShopService } from "@/services/verification.service";
import { useFeedModulePreferencesStore } from "@/store/feedModulePreferences.store";
import type { VerificationProfileType } from "@/types/models.type";
import type { CurrencyCode } from "@/types/money.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { canShowGetVerifiedCard, emptyGetVerifiedCardHistory, offerIdsNotYetSurfaced } from "@/utils/getVerifiedCardFrequency.util";
import { describeGetVerifiedDiscount, pickGetVerifiedDiscountHighlight, resolveGetVerifiedCardState, type GetVerifiedCardState } from "@/utils/getVerifiedCardState.util";

const sessionDecisionByViewer = new Map<string, boolean>();
const sessionDismissedViewers = new Set<string>();

function usePreferencesHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useFeedModulePreferencesStore.persist.hasHydrated()) return setHydrated(true);
    return useFeedModulePreferencesStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

export function useGetVerifiedFeedCard() {
  const router = useRouter();
  const viewer = useSession().viewer;
  const viewerId = viewer?.id ?? null;
  const hydrated = usePreferencesHydrated();
  const history = useFeedModulePreferencesStore((state) => (viewerId ? state.getVerifiedHistoryByViewer[viewerId] : undefined)) ?? emptyGetVerifiedCardHistory;
  const preferences = useFeedModulePreferencesStore.getState();
  const [, forceRender] = useState(0);
  const signedIn = viewerId !== null;

  const myVerification = useQuery({ queryKey: ["verification", "me"], queryFn: () => verificationShopService.fetchMyVerification(), enabled: signedIn, staleTime: 300_000 });
  const suggestions = useQuery({ queryKey: ["verification", "suggestions"], queryFn: () => verificationShopService.listCheckmarkSuggestions(), enabled: signedIn, staleTime: 300_000 });
  const profileType: VerificationProfileType = myVerification.data?.current?.type ?? (viewer?.profileKind === "business" || viewer?.profileKind === "store" ? "business" : "personal");
  const state: GetVerifiedCardState = useMemo(() => {
    if (!signedIn || suggestions.isPending) return { kind: "hidden" };
    const color = profileType === "personal" ? "blue" : "gold";
    const dismissedOnServer = (suggestions.data ?? []).some((suggestion) => suggestion.color === color && suggestion.dismissed);
    return resolveGetVerifiedCardState({ profileType, myVerification: myVerification.data, dismissedOnServer });
  }, [signedIn, suggestions.isPending, suggestions.data, profileType, myVerification.data]);
  const discounts = useQuery({ queryKey: ["verification", "discounts"], queryFn: () => verificationShopService.fetchVerificationDiscounts(), enabled: signedIn && state.kind === "offer", staleTime: 600_000 });
  const highlight = state.kind === "offer" ? pickGetVerifiedDiscountHighlight(discounts.data, state.color) : null;
  const discountLine = highlight ? describeGetVerifiedDiscount(highlight, (amountMinor, currency) => formatMoneyForDisplay({ amountMinor, currency: currency as CurrencyCode })) : null;

  if (viewerId && hydrated && !sessionDecisionByViewer.has(viewerId)) sessionDecisionByViewer.set(viewerId, canShowGetVerifiedCard(history, Date.now()));
  const visible = viewerId !== null && sessionDecisionByViewer.get(viewerId) === true && !sessionDismissedViewers.has(viewerId) && state.kind !== "hidden";

  useEffect(() => {
    if (!viewerId || !hydrated || visible || history.neverShowAgain || highlight?.kind !== "offerLink") return;
    if (offerIdsNotYetSurfaced(history, [highlight.offer.linkId]).length === 0) return;
    preferences.markDiscountOffersSurfaced(viewerId, [highlight.offer.linkId]);
    showToast({ text: discountLine ?? "You have a verification offer waiting.", actionLabel: "View offer", actionHref: `/offer/${encodeURIComponent(highlight.offer.token)}` });
  }, [viewerId, hydrated, visible, history, highlight, discountLine, preferences]);

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
    if (state.kind !== "hidden") void verificationShopService.dismissCheckmarkSuggestion(state.color).catch(() => undefined);
    hideForThisSession();
  }, [viewerId, preferences, state, hideForThisSession]);

  const openVerificationFlow = useCallback(() => {
    router.push(highlight?.kind === "offerLink" ? `/offer/${encodeURIComponent(highlight.offer.token)}` : "/verification");
  }, [highlight, router]);

  return {
    visible,
    state,
    discountLine,
    hasPersonalOffer: highlight?.kind === "offerLink",
    viewerName: viewer?.name ?? "",
    viewerAvatarUrl: viewer?.avatarUrl ?? null,
    recordImpression,
    dismiss,
    neverShowAgain,
    openVerificationFlow,
  };
}

export type GetVerifiedFeedCardModel = ReturnType<typeof useGetVerifiedFeedCard>;
