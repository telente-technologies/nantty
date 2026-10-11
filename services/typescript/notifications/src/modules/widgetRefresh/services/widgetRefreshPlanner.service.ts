import type { DomainEventEnvelope } from "../../../types/domainEvent.type.js";

export type WidgetKind = "orders" | "sellerToday" | "liveNow" | "creatorToday" | "stories";

export const widgetRefreshBucketMinutes: Readonly<Record<WidgetKind, number>> = { orders: 5, sellerToday: 10, liveNow: 15, creatorToday: 30, stories: 30 };

export interface WidgetRefreshTarget {
  readonly userId: string;
  readonly widget: WidgetKind;
}

export interface WidgetRefreshPlan {
  readonly targets: readonly WidgetRefreshTarget[];
  readonly storyAuthorId: string | null;
}

const buyerOrderEvents = new Set(["order.paid", "order.sellerAccepted", "order.sellerRejected", "order.shipped", "order.delivered", "order.completed", "order.cancelled"]);
const sellerOrderEvents = new Set(["order.paid", "order.completed", "order.cancelled"]);

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function sellerUserIds(data: Readonly<Record<string, unknown>>): string[] {
  const groups = Array.isArray(data["groups"]) ? data["groups"] : [];
  const fromGroups = groups.map((group) => text((group as Record<string, unknown> | null)?.["sellerUserId"])).filter((id): id is string => id !== null);
  const direct = text(data["sellerUserId"]);
  return [...new Set(direct === null ? fromGroups : [...fromGroups, direct])];
}

export function planWidgetRefresh(event: DomainEventEnvelope, maximumDirectRecipients: number): WidgetRefreshPlan {
  const targets: WidgetRefreshTarget[] = [];
  const data = event.data;
  if (buyerOrderEvents.has(event.type)) {
    const buyer = text(data["buyerUserId"]);
    if (buyer !== null) targets.push({ userId: buyer, widget: "orders" });
  }
  if (sellerOrderEvents.has(event.type)) for (const seller of sellerUserIds(data)) targets.push({ userId: seller, widget: "sellerToday" });
  if (event.type === "live.started" && Array.isArray(data["notifyUserIds"])) {
    for (const userId of data["notifyUserIds"].slice(0, maximumDirectRecipients)) {
      const id = text(userId);
      if (id !== null) targets.push({ userId: id, widget: "liveNow" });
    }
  }
  const storyAuthorId = event.type === "post.created" && data["kind"] === "story" ? text(data["authorId"]) : null;
  return { targets, storyAuthorId };
}

export function widgetRefreshDedupeKey(target: WidgetRefreshTarget, now: Date): string {
  const bucket = Math.floor(now.getTime() / (widgetRefreshBucketMinutes[target.widget] * 60_000));
  return `widgetRefresh:${target.widget}:${target.userId}:${bucket}`;
}
