"use client";

import Link from "next/link";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { staffRoleLabels } from "@/constants/roles.constant";
import { usePosRegisterContext } from "@/hooks/usePosRegisterContext.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";

import styles from "./posRegisterTopBar.module.css";

export function PosRegisterTopBar() {
  const { sessionView, can } = useSellerSession();
  const { locations, selectedLocationId, selectLocation } = useStoreContext();
  const { selectedRegister, isOnline, queuedSales, lockRegister } = usePosRegisterContext();
  const pendingCount = queuedSales.filter((sale) => sale.status === "queued").length;
  const cashierName = sessionView?.operator?.name ?? sessionView?.user.name ?? "Cashier";
  const role = sessionView?.effectiveRole;

  return (
    <header className={`${styles.topBar} noPrint`}>
      {can("dashboard:view") || can("products:manage") ? (
        <Link href="/" className={styles.backLink} aria-label="Back to dashboard">
          <ZudoIcon name="arrowLeft24" size={18} />
          <span className={styles.hideOnNarrow}>Dashboard</span>
        </Link>
      ) : null}
      <div className={styles.identity}>
        <span className={styles.storeName}>{sessionView?.access.storeName ?? "Register"}</span>
        <span className={styles.registerName}>{selectedRegister?.name ?? "No register chosen"}</span>
      </div>
      {locations.length > 1 ? (
        <label className={styles.locationSelect}>
          <span className="visuallyHidden">Location</span>
          <ZudoIcon name="mapPin24" size={16} />
          <select value={selectedLocationId ?? ""} onChange={(event) => void selectLocation(event.target.value)} disabled={!isOnline}>
            {locations.filter((location) => location.active && location.kind === "store").map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <nav className={styles.links} aria-label="Register">
        <Link href="/pos">Sell</Link>
        <Link href="/pos/shift">Shift</Link>
        <Link href="/sales" className={styles.hideOnNarrow}>Sales</Link>
      </nav>
      <span className={`${styles.connection} ${isOnline ? styles.online : styles.offline}`} role="status">
        <span className={styles.dot} aria-hidden="true" />
        {isOnline ? "Online" : "Offline"}
        {pendingCount > 0 ? ` · ${pendingCount} to sync` : ""}
      </span>
      <span className={styles.cashier}>
        <span className={styles.cashierName}>{cashierName}</span>
        <span className={styles.cashierRole}>{role ? staffRoleLabels[role] : ""}</span>
      </span>
      <Button size="small" iconName="shield24" onClick={() => void lockRegister()} disabled={!isOnline} title={isOnline ? "Lock and switch cashier" : "Switching cashier needs a connection"}>
        <span className={styles.hideOnNarrow}>Lock</span>
      </Button>
    </header>
  );
}
