"use client";

import { useState } from "react";

import { LocationFormDialog } from "@/components/settings/locationFormDialog";
import { useCanEditStoreSettings } from "@/components/settings/settingsFormFrame";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { StoreLocation } from "@/types/store.type";

import styles from "./settings.module.css";

export function LocationsSettingsView() {
  const canEdit = useCanEditStoreSettings();
  const { can } = useSellerSession();
  const { reloadStoreContext } = useStoreContext();
  const { showToast } = useToast();
  const locationsQuery = useSellerQuery<CursorPage<StoreLocation>>("/seller/locations");
  const [editingLocation, setEditingLocation] = useState<StoreLocation | "new" | null>(null);
  const [busyLocationId, setBusyLocationId] = useState<string | null>(null);
  const locations = locationsQuery.data?.data ?? [];
  const { limits } = usePlanFeatures();
  const maximumLocations = limits.maxLocations;
  const activeLocationCount = locations.filter((location) => location.active).length;
  const isAtLocationLimit = activeLocationCount >= maximumLocations;

  function refreshLocations() {
    locationsQuery.reload();
    reloadStoreContext();
  }

  async function updateLocation(location: StoreLocation, changes: Partial<Pick<StoreLocation, "active" | "isDefault">>, successMessage: string) {
    setBusyLocationId(location.id);
    try {
      await sendSellerApiRequest(`/seller/locations/${encodeURIComponent(location.id)}`, { method: "PATCH", body: changes });
      showToast(successMessage);
      refreshLocations();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyLocationId(null);
    }
  }

  const locationUsageText = `${activeLocationCount} of ${maximumLocations} locations in use`;

  return (
    <Panel
      title="Locations & warehouses"
      description={locationUsageText}
      actions={canEdit ? <Button variant="primary" iconName="plus16" disabled={isAtLocationLimit} onClick={() => setEditingLocation("new")}>Add location</Button> : null}
    >
      <div className={styles.formStack}>
        {canEdit && isAtLocationLimit ? (
          <Callout tone="caution" title="You have used every location on your plan" action={can("billing:manage") ? <ButtonLink href="/settings/billing" size="small">See plans</ButtonLink> : null}>
            Deactivate a location or move to a bigger plan to add another.
          </Callout>
        ) : null}
        {locationsQuery.isLoading && locations.length === 0 ? <LoadingBlock label="Loading locations" /> : null}
        {locationsQuery.errorMessage ? <ErrorCallout message={locationsQuery.errorMessage} onRetry={locationsQuery.reload} /> : null}
        <ul className={styles.listReset}>
          {locations.map((location) => (
            <li key={location.id} className={styles.rowCard}>
              <div className={styles.rowHeader}>
                <span className={styles.rowTitle}>
                  {location.name}
                  <StatusBadge tone="neutral">{location.kind === "store" ? "Store" : "Warehouse"}</StatusBadge>
                  {location.isDefault ? <StatusBadge tone="info">Default</StatusBadge> : null}
                  {location.active ? null : <StatusBadge tone="caution">Inactive</StatusBadge>}
                </span>
                {canEdit ? (
                  <span className={styles.inlineActions}>
                    <Button size="small" onClick={() => setEditingLocation(location)}>Edit</Button>
                    {!location.isDefault && location.active ? (
                      <Button size="small" variant="ghost" disabled={busyLocationId !== null} onClick={() => void updateLocation(location, { isDefault: true }, `${location.name} is now the default.`)}>
                        Make default
                      </Button>
                    ) : null}
                    {!location.isDefault ? (
                      <Button
                        size="small"
                        variant={location.active ? "ghost" : "secondary"}
                        isBusy={busyLocationId === location.id}
                        disabled={busyLocationId !== null || (!location.active && isAtLocationLimit)}
                        onClick={() => void updateLocation(location, { active: !location.active }, location.active ? `${location.name} deactivated.` : `${location.name} activated.`)}
                      >
                        {location.active ? "Deactivate" : "Activate"}
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <p className={styles.mutedText}>
                {location.address}, {location.city}, {location.state}
                {location.phone ? ` · ${location.phone}` : ""}
              </p>
              <p className={styles.mutedText}>{location.kind === "store" ? "Shop or pickup point. Stock here can fulfil online orders." : "Holds stock for online orders and transfers."}</p>
            </li>
          ))}
        </ul>
      </div>
      {editingLocation ? (
        <LocationFormDialog key={editingLocation === "new" ? "new" : editingLocation.id} location={editingLocation === "new" ? null : editingLocation} isOpen onClose={() => setEditingLocation(null)} onSaved={refreshLocations} />
      ) : null}
    </Panel>
  );
}
