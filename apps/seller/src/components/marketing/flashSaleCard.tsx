"use client";

import { formatRemainingTimeUntil, marketingCampaignStatusLabels, marketingCampaignStatusTones } from "@/components/marketing/marketingPresentation.util";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { FlashSale } from "@/types/marketing.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./marketing.module.css";

export type FlashSaleAction = "pause" | "resume" | "end" | "edit" | "delete";

export function FlashSaleCard({ sale, now, busyAction, onAction }: { readonly sale: FlashSale; readonly now: number; readonly busyAction: FlashSaleAction | null; readonly onAction: (action: FlashSaleAction) => void }) {
  const { formatMoney, locale } = useMoneyFormatter();
  const unitsSold = sale.items.reduce((sum, item) => sum + item.soldCount, 0);
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <div>
          <p className={styles.cardTitle}>{sale.name}</p>
          <p className={styles.muted}>{formatDateTimeForDisplay(sale.startsAt)} – {formatDateTimeForDisplay(sale.endsAt)}</p>
        </div>
        <StatusBadge tone={marketingCampaignStatusTones[sale.status]}>{marketingCampaignStatusLabels[sale.status]}</StatusBadge>
      </header>
      {sale.status === "active" ? <p>Ends in <span className={styles.countdown}>{formatRemainingTimeUntil(sale.endsAt, now)}</span></p> : null}
      {sale.status === "scheduled" ? <p>Starts in <span className={styles.countdown}>{formatRemainingTimeUntil(sale.startsAt, now)}</span></p> : null}
      <ul className={styles.itemList}>
        {sale.items.map((item) => (
          <li key={item.productId} className={styles.stack} style={{ gap: 4 }}>
            <span className={styles.itemRow}>
              {item.imageUrl ? <img src={item.imageUrl} alt="" width={32} height={32} className={styles.thumbnail} /> : <span className={styles.thumbnail} aria-hidden="true" />}
              <span className={styles.itemName}>{item.productName}</span>
              <span className={styles.strike}>{formatMoney(item.originalPrice)}</span>
              <strong>{formatMoney(item.salePrice)}</strong>
            </span>
            {item.stockCap ? (
              <>
                <span className={styles.progressTrack} role="progressbar" aria-label={`${item.productName} sold`} aria-valuemin={0} aria-valuemax={item.stockCap} aria-valuenow={item.soldCount}>
                  <span className={styles.progressBar} style={{ width: `${Math.min(100, (item.soldCount / item.stockCap) * 100)}%` }} />
                </span>
                <span className={styles.muted}>{item.soldCount} of {item.stockCap} sold</span>
              </>
            ) : (
              <span className={styles.muted}>{item.soldCount} sold · no stock cap</span>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.muted}>{unitsSold.toLocaleString(locale)} units · {formatMoney(sale.revenue)} · reached {sale.reach.toLocaleString(locale)} buyers</p>
      <div className={styles.cardActions}>
        {sale.status === "active" ? <Button size="small" isBusy={busyAction === "pause"} onClick={() => onAction("pause")}>Pause</Button> : null}
        {sale.status === "paused" ? <Button size="small" isBusy={busyAction === "resume"} onClick={() => onAction("resume")}>Resume</Button> : null}
        {sale.status === "active" || sale.status === "paused" ? <Button size="small" variant="ghost" isBusy={busyAction === "end"} onClick={() => onAction("end")}>End now</Button> : null}
        {sale.status !== "ended" ? <Button size="small" variant="ghost" onClick={() => onAction("edit")}>Edit</Button> : null}
        {sale.status !== "active" ? <Button size="small" variant="ghost" isBusy={busyAction === "delete"} onClick={() => onAction("delete")}>Delete</Button> : null}
      </div>
    </article>
  );
}
