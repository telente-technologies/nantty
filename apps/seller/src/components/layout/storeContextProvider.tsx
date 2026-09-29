"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { StoreContext, type StoreContextValue } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendRequestToDashboardServer } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { StoreLocation, StoreSettings } from "@/types/store.type";

export function StoreContextProvider({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { sessionView, refreshSessionView } = useSellerSession();
  const settingsQuery = useSellerQuery<StoreSettings>("/seller/settings");
  const locationsQuery = useSellerQuery<CursorPage<StoreLocation>>("/seller/locations");
  const locations = useMemo(() => locationsQuery.data?.data ?? [], [locationsQuery.data]);
  const selectedLocationId = sessionView?.selectedLocationId ?? locations.find((location) => location.isDefault)?.id ?? locations[0]?.id ?? null;

  const selectLocation = useCallback(
    async (locationId: string) => {
      try {
        await sendRequestToDashboardServer("/bff/session/location", { method: "POST", body: { locationId } });
        await refreshSessionView();
        router.refresh();
      } catch (error) {
        showToast(readErrorMessageForDisplay(error), "error");
      }
    },
    [refreshSessionView, router, showToast],
  );

  const reloadStoreContext = useCallback(() => {
    settingsQuery.reload();
    locationsQuery.reload();
  }, [settingsQuery, locationsQuery]);

  const contextValue = useMemo<StoreContextValue>(
    () => ({ settings: settingsQuery.data, locations, selectedLocationId, selectLocation, reloadStoreContext }),
    [settingsQuery.data, locations, selectedLocationId, selectLocation, reloadStoreContext],
  );
  return <StoreContext.Provider value={contextValue}>{children}</StoreContext.Provider>;
}
