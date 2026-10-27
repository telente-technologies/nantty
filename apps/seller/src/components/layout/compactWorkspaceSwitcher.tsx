"use client";

import { useEffect, useRef, useState } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { sellerPlanLabels } from "@/config/planFeatures.config";
import { staffRoleLabels } from "@/constants/roles.constant";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendRequestToDashboardServer } from "@/services/clientApi.service";
import { readMyStoreEntries, type MyStoresResponse } from "@/utils/myStores.util";

import styles from "./compactWorkspaceSwitcher.module.css";

export function CompactWorkspaceSwitcher() {
  const { sessionView } = useSellerSession();
  const { plan } = usePlanFeatures();
  const { locations, selectedLocationId, selectLocation } = useStoreContext();
  const { showToast } = useToast();
  const storesQuery = useSellerQuery<MyStoresResponse>("/seller/stores/mine");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stores = readMyStoreEntries(storesQuery.data);
  const activeLocations = locations.filter((location) => location.active);
  const selectedLocationName = activeLocations.find((location) => location.id === selectedLocationId)?.name ?? null;

  useEffect(() => {
    if (!isMenuOpen) return;
    function closeMenuOnOutsideClickOrEscape(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !containerRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenuOnOutsideClickOrEscape);
    document.addEventListener("keydown", closeMenuOnOutsideClickOrEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenuOnOutsideClickOrEscape);
      document.removeEventListener("keydown", closeMenuOnOutsideClickOrEscape);
    };
  }, [isMenuOpen]);

  async function switchToStoreFromCompactMenu(storeId: string) {
    try {
      const result = await sendRequestToDashboardServer<{ redirectTo: string }>("/bff/session/store", { method: "POST", body: { storeId } });
      window.location.assign(result.redirectTo);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button type="button" className={styles.trigger} aria-haspopup="menu" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}>
        <span className={styles.triggerText}>
          <span className={styles.storeName}>{sessionView?.access.storeName ?? "Your store"}</span>
          <span className={styles.meta}>
            {sellerPlanLabels[plan]}
            {selectedLocationName ? ` · ${selectedLocationName}` : ""}
          </span>
        </span>
        <NanttyIcon name="caretDown24" size={14} />
      </button>
      {isMenuOpen ? (
        <div className={styles.menu} role="menu" aria-label="Store, plan and location">
          <div className={styles.planRow}>
            <span>Plan</span>
            <StatusBadge tone={plan === "free" ? "neutral" : "highlight"}>{sellerPlanLabels[plan]}</StatusBadge>
          </div>
          {stores.length > 1 ? <p className={styles.heading}>Store</p> : null}
          {stores.length > 1
            ? stores.map((store) => (
                <button key={store.storeId} type="button" role="menuitemradio" aria-checked={store.isCurrent} className={styles.item} disabled={store.isCurrent} onClick={() => void switchToStoreFromCompactMenu(store.storeId)}>
                  <span>
                    {store.storeName}
                    <span className={styles.meta}> · {staffRoleLabels[store.role]}</span>
                  </span>
                  {store.isCurrent ? <NanttyIcon name="check16" size={14} /> : null}
                </button>
              ))
            : null}
          {activeLocations.length > 0 ? <p className={styles.heading}>Location</p> : null}
          {activeLocations.map((location) => (
            <button
              key={location.id}
              type="button"
              role="menuitemradio"
              aria-checked={location.id === selectedLocationId}
              className={styles.item}
              onClick={() => {
                setIsMenuOpen(false);
                void selectLocation(location.id);
              }}
            >
              <span>{location.name}</span>
              {location.id === selectedLocationId ? <NanttyIcon name="check16" size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
