import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

import { creatorQueryKeys } from "@/components/creator/creatorQueries.hook";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { fetchStoreDisplayPrice, purchaseCreatorSubscriptionInStore, restoreCreatorStoreSubscriptions } from "@/services/money/creatorStorePurchase.service";
import { resolveStoreBillingAvailability } from "@/services/money/nativeStoreBilling.service";
import type { CreatorSubscriptionState } from "@/types/creator.type";

export const NEEDS_APP_BUILD_MESSAGE = "Subscriptions need the Zudomart app build. Install the Zudomart app from the App Store or Google Play to subscribe.";

export function useCreatorStoreSubscription(creatorId: string, storeProductId: string | null | undefined) {
  const queryClient = useQueryClient();
  const availability = useMemo(() => resolveStoreBillingAvailability(), []);
  const idempotencyKey = useRef(generateIdempotencyKey());
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: creatorQueryKeys.plansOfCreator(creatorId) });
    queryClient.invalidateQueries({ queryKey: creatorQueryKeys.mySubscriptions });
  };

  const storePrice = useQuery({
    queryKey: ["creatorStorePrice", storeProductId],
    enabled: availability.kind === "ready" && Boolean(storeProductId),
    queryFn: () => (availability.kind === "ready" && storeProductId ? fetchStoreDisplayPrice(availability.billing, storeProductId) : null),
    staleTime: 10 * 60_000,
  });

  const subscribe = useMutation<CreatorSubscriptionState, Error, string>({
    mutationFn: (planId) => {
      if (availability.kind !== "ready") throw new Error(NEEDS_APP_BUILD_MESSAGE);
      return purchaseCreatorSubscriptionInStore({ billing: availability.billing, platform: availability.platform }, creatorId, planId, idempotencyKey.current);
    },
    onSettled: (state) => {
      if (state?.status === "active") idempotencyKey.current = generateIdempotencyKey();
      refresh();
    },
  });

  const restore = useMutation({
    mutationFn: () => {
      if (availability.kind !== "ready") throw new Error(NEEDS_APP_BUILD_MESSAGE);
      return restoreCreatorStoreSubscriptions({ billing: availability.billing, platform: availability.platform });
    },
    onSuccess: refresh,
  });

  return { availability: availability.kind, storeDisplayPrice: storePrice.data ?? null, subscribe, restore };
}
