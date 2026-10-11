"use client";

import Link from "next/link";

import { orderStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { ZudoIcon, type ZudoIconName } from "@/components/ui/zudoIcon";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { DashboardActivityKind, DashboardAlert, DashboardSummary } from "@/types/dashboard.type";
import { formatDateTimeForDisplay, formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./dashboard.module.css";

const activityIconByKind: Record<DashboardActivityKind, ZudoIconName> = {
  order_placed: "shoppingCart24",
  order_shipped: "truck24",
  order_delivered: "check16",
  dispute_opened: "warning20",
  return_requested: "repeat24",
  team_action: "shield24",
};

const alertToneBySeverity: Record<DashboardAlert["severity"], StatusTone> = { info: "info", caution: "caution", error: "error" };

export function DashboardRecentOrdersPanel({ summary }: { readonly summary: DashboardSummary }) {
  const { formatMoney } = useMoneyFormatter();
  return (
    <Panel title="Recent orders" description="Placed by customers in the Zudomart app" actions={<ButtonLink href="/orders" size="small">All orders</ButtonLink>}>
      {summary.recentOrders.length === 0 ? (
        <EmptyState iconName="shoppingCart24" title="No orders yet" description="Orders from the app show up here the moment customers pay." />
      ) : (
        <ul className={styles.listRows}>
          {summary.recentOrders.map((order) => (
            <li key={order.id} className={styles.listRow}>
              <span className={styles.rowMain}>
                <Link href={`/orders/${order.id}`} className={styles.rowTitle}>
                  {order.orderNumber} · {order.customerName}
                </Link>
                <span className={styles.rowMeta} title={formatDateTimeForDisplay(order.createdAt)}>
                  @{order.customerUsername} · {order.itemsCount} {order.itemsCount === 1 ? "item" : "items"} · {formatRelativeTimeFromNow(order.createdAt)}
                </span>
              </span>
              <StatusBadge tone={orderStatusPresentation[order.status].tone}>{orderStatusPresentation[order.status].label}</StatusBadge>
              <span className={styles.rowValue}>{formatMoney(order.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function DashboardActivityFeedPanel({ summary }: { readonly summary: DashboardSummary }) {
  return (
    <Panel title="Activity" description="Orders, deliveries and what your team did">
      {summary.activity.length === 0 ? (
        <EmptyState title="Quiet so far" description="New orders, shipments and team changes appear here." />
      ) : (
        <ol className={styles.listRows}>
          {summary.activity.map((entry) => (
            <li key={entry.id} className={styles.listRow}>
              <span className={styles.activityIcon} aria-hidden="true">
                <ZudoIcon name={activityIconByKind[entry.kind]} size={14} />
              </span>
              <span className={styles.rowMain}>
                {entry.href ? (
                  <Link href={entry.href} className={styles.activityText}>
                    {entry.summary}
                  </Link>
                ) : (
                  <span className={styles.activityText}>{entry.summary}</span>
                )}
                <span className={styles.rowMeta} title={formatDateTimeForDisplay(entry.createdAt)}>
                  {entry.actorName ? `${entry.actorName} · ` : ""}
                  {formatRelativeTimeFromNow(entry.createdAt)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function DashboardAlertsPanel({ summary }: { readonly summary: DashboardSummary }) {
  if (summary.alerts.length === 0) {
    return (
      <Panel title="Needs your attention">
        <EmptyState iconName="sealCheck20" title="You are all caught up" description="No orders, disputes or stock problems waiting on you." />
      </Panel>
    );
  }
  return (
    <Panel title="Needs your attention" description={`${summary.alerts.length} ${summary.alerts.length === 1 ? "thing" : "things"} to look at`}>
      <ul className={styles.alertList}>
        {summary.alerts.map((alert) => (
          <li key={alert.kind}>
            <Link href={alert.href} className={styles.alertCard}>
              <StatusBadge tone={alertToneBySeverity[alert.severity]}>{alert.count}</StatusBadge>
              <span className={styles.rowMain}>
                <span className={styles.alertTitle}>{alert.title}</span>
                <span className={styles.rowMeta}>{alert.description}</span>
              </span>
              <ZudoIcon name="caretRight24" size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
