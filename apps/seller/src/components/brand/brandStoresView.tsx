"use client";

import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { staffRoleLabels } from "@/constants/roles.constant";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Brand, MyStoreEntry } from "@/types/brand.type";
import { canBrandRoleManage } from "@/utils/brandPresentation.util";

import styles from "./brand.module.css";

function describeStoreGoldState(store: MyStoreEntry | undefined): string {
  if (!store) return "Managed by another team member";
  if (store.verification.badgeVisible) return `Gold ${store.verification.tier === "PREMIUM" ? "Premium" : "Pro"}`;
  return store.verification.status === "verified" ? "Verified, no active Gold plan" : "Not Gold verified";
}

export function BrandStoresView() {
  const { brand, myRole, myStores, canEditDashboardSettings, replaceBrand, reloadBrand } = useBrandWorkspace();
  const { showToast } = useToast();
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null);
  const canManage = canEditDashboardSettings && canBrandRoleManage(myRole);
  const linkableStores = myStores.filter((store) => !brand.storeIds.includes(store.storeId) && store.brandId === null && (store.role === "owner" || store.role === "manager"));

  async function linkStoreToBrand(store: MyStoreEntry) {
    setBusyStoreId(store.storeId);
    try {
      replaceBrand(await sendSellerApiRequest<Brand>(`/seller/brands/${encodeURIComponent(brand.id)}/stores`, { method: "POST", body: { storeId: store.storeId } }));
      showToast(`${store.storeName} now sells as ${brand.name}.`);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyStoreId(null);
    }
  }

  async function unlinkStoreFromBrand(storeId: string, storeName: string) {
    if (!(await requestConfirmation({ title: `Unlink ${storeName} from ${brand.name}?`, description: "Its products tagged as your own brand will need a new tag.", confirmLabel: "Unlink store", tone: "danger", intent: "remove" }))) return;
    setBusyStoreId(storeId);
    try {
      await sendSellerApiRequest(`/seller/brands/${encodeURIComponent(brand.id)}/stores/${encodeURIComponent(storeId)}`, { method: "DELETE" });
      showToast(`${storeName} was unlinked.`);
      reloadBrand();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyStoreId(null);
    }
  }

  return (
    <div className={styles.twoColumns}>
      <Panel title="Stores selling as this brand" description="Stores belong to a brand or to an individual. Linked stores can tag products as your own brand.">
        {brand.storeIds.length === 0 ? (
          <EmptyState iconName="buildingStore20" title="No stores linked yet" description="Link one of your stores so it can sell as this brand." />
        ) : (
          <ul className={styles.checklist}>
            {brand.storeIds.map((storeId) => {
              const store = myStores.find((candidate) => candidate.storeId === storeId);
              const storeName = store?.storeName ?? storeId;
              const isOfficialStore = brand.officialStore.storeId === storeId && brand.officialStore.status === "active";
              return (
                <li key={storeId} className={styles.checkItem}>
                  <div style={{ flex: 1 }}>
                    <p className={styles.checkLabel}>{storeName} {isOfficialStore ? <StatusBadge tone="highlight">Official Store</StatusBadge> : null}</p>
                    <p className={styles.muted}>{describeStoreGoldState(store)}{store ? ` · You are ${staffRoleLabels[store.role].toLowerCase()}` : ""}</p>
                  </div>
                  {canManage ? <Button size="small" variant="ghost" disabled={isOfficialStore || busyStoreId === storeId} onClick={() => void unlinkStoreFromBrand(storeId, storeName)}>Unlink</Button> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel title="Link another store">
        {!canManage ? (
          <Callout tone="info">Only brand owners and admins can link stores.</Callout>
        ) : linkableStores.length === 0 ? (
          <p className={styles.muted}>All the stores you own or run are already linked to a brand. Stores you only work at as staff can't be linked by you.</p>
        ) : (
          <ul className={styles.checklist}>
            {linkableStores.map((store) => (
              <li key={store.storeId} className={styles.checkItem}>
                <div style={{ flex: 1 }}>
                  <p className={styles.checkLabel}>{store.storeName}</p>
                  <p className={styles.muted}>{describeStoreGoldState(store)}</p>
                </div>
                <Button size="small" isBusy={busyStoreId === store.storeId} onClick={() => void linkStoreToBrand(store)}>Link</Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
