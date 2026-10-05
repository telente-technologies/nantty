"use client";

import { useEffect, useRef, useState } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { sellerPlanLabels } from "@/config/planFeatures.config";
import { staffRoleLabels } from "@/constants/roles.constant";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendRequestToDashboardServer } from "@/services/clientApi.service";
import type { BrandSummary } from "@/types/brand.type";
import type { CursorPage } from "@/types/pagination.type";
import { readMyStoreEntries, type MyStoresResponse } from "@/utils/myStores.util";

import styles from "./storeSwitcher.module.css";

export function StoreSwitcher() {
  const { sessionView, can } = useSellerSession();
  const { showToast } = useToast();
  const storesQuery = useSellerQuery<MyStoresResponse>("/seller/stores/mine");
  const brandsQuery = useSellerQuery<CursorPage<BrandSummary>>(can("settings:view") ? "/seller/brands" : null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [switchingStoreId, setSwitchingStoreId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const access = sessionView?.access;
  const { plan } = usePlanFeatures();
  const stores = readMyStoreEntries(storesQuery.data);
  const brands = brandsQuery.data?.data ?? [];
  const brandNameById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const currentBrandId = stores.find((store) => store.storeId === access?.storeId)?.brandId;
  const currentBrandName = currentBrandId ? brandNameById.get(currentBrandId) ?? null : null;
  const canSwitch = stores.length > 1 || brands.length > 1;

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

  async function switchToStore(storeId: string) {
    setSwitchingStoreId(storeId);
    try {
      const result = await sendRequestToDashboardServer<{ redirectTo: string }>("/bff/session/store", { method: "POST", body: { storeId } });
      window.location.assign(result.redirectTo);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
      setSwitchingStoreId(null);
    }
  }

  const goldBadge = (
    <StatusBadge tone={plan === "free" ? "neutral" : "highlight"}>
      {access?.verification.badgeVisible ? <ZudoIcon name="sealCheck20" size={14} /> : null} {sellerPlanLabels[plan]}
    </StatusBadge>
  );

  if (!canSwitch) {
    return (
      <div className={styles.identity}>
        <span className={styles.storeName}>{access?.storeName ?? "Your store"}</span>
        {goldBadge}
      </div>
    );
  }

  return (
    <div className={styles.switcher} ref={containerRef}>
      <button type="button" className={styles.trigger} aria-haspopup="menu" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((wasOpen) => !wasOpen)}>
        <span className={styles.triggerText}>
          <span className={styles.storeName}>{access?.storeName ?? "Your store"}</span>
          {currentBrandName && currentBrandName !== access?.storeName ? <span className={styles.brandName}>{currentBrandName}</span> : null}
        </span>
        <ZudoIcon name="caretDown24" size={14} />
      </button>
      {goldBadge}
      {isMenuOpen ? (
        <div className={styles.menu} role="menu" aria-label="Switch store">
          <p className={styles.menuHeading}>Your stores</p>
          {stores.map((store) => (
            <button key={store.storeId} type="button" role="menuitemradio" aria-checked={store.isCurrent} className={styles.menuItem} disabled={store.isCurrent || switchingStoreId !== null} onClick={() => void switchToStore(store.storeId)}>
              <span className={styles.menuItemText}>
                <span className={styles.menuItemName}>{store.storeName}</span>
                <span className={styles.menuItemMeta}>
                  {staffRoleLabels[store.role]}
                  {store.brandId && brandNameById.get(store.brandId) ? ` · ${brandNameById.get(store.brandId)}` : ""}
                  {store.subscription && (store.subscription.status === "active" || store.subscription.status === "trialing") ? ` · ${store.subscription.plan === "BUSINESS" ? "Business" : "Pro"}` : " · Free"}
                </span>
              </span>
              {store.isCurrent ? <ZudoIcon name="check16" size={14} /> : switchingStoreId === store.storeId ? <span className={styles.menuItemMeta}>Switching…</span> : null}
            </button>
          ))}
          {brands.length > 0 ? (
            <>
              <p className={styles.menuHeading}>Brands you manage</p>
              {brands.map((brand) => (
                <a key={brand.id} role="menuitem" href="/brand" className={styles.menuItem}>
                  <span className={styles.menuItemText}>
                    <span className={styles.menuItemName}>{brand.name}</span>
                    <span className={styles.menuItemMeta}>{brand.officialStoreStatus === "active" ? "Official Store" : brand.registrationStatus === "registered" ? "Registered brand" : "Registration pending"}</span>
                  </span>
                </a>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
