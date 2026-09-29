import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { NotificationCategory } from "../../../events/notificationRequested.event.js";
import {
  convertCategoryToDisplayCategory,
  type NewNotification,
  type NotificationFilter,
  type NotificationRecord,
  type UnreadNotificationCounts,
} from "../models/notifications.model.js";

export interface NotificationsRepository {
  create(notification: NewNotification, createdAt: Date): Promise<NotificationRecord>;
  listForUser(userId: string, filter: NotificationFilter, page: PageRequest): Promise<Page<NotificationRecord>>;
  countUnreadForUser(userId: string): Promise<UnreadNotificationCounts>;
  markOwnNotificationRead(userId: string, notificationId: string, readAt: Date): Promise<boolean>;
  markAllOwnNotificationsRead(userId: string, readAt: Date): Promise<number>;
}

export function summarizeUnreadCategories(categories: readonly NotificationCategory[]): UnreadNotificationCounts {
  const byCategory: Record<string, number> = { orders: 0, social: 0, system: 0 };
  for (const category of categories) {
    const displayCategory = convertCategoryToDisplayCategory(category);
    byCategory[displayCategory] = (byCategory[displayCategory] ?? 0) + 1;
  }
  return { total: categories.length, byCategory };
}

export class InMemoryNotificationsRepository implements NotificationsRepository {
  private readonly notifications = new Map<string, NotificationRecord>();

  public async create(notification: NewNotification, createdAt: Date): Promise<NotificationRecord> {
    const record: NotificationRecord = { ...notification, id: randomUUID(), readAt: null, createdAt };
    this.notifications.set(record.id, record);
    return record;
  }

  public async listForUser(userId: string, filter: NotificationFilter, page: PageRequest): Promise<Page<NotificationRecord>> {
    const matches = [...this.notifications.values()]
      .filter((notification) => notification.userId === userId)
      .filter((notification) => filter.categories === undefined || filter.categories.includes(notification.category))
      .filter((notification) => filter.unreadOnly !== true || notification.readAt === null)
      .sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }

  public async countUnreadForUser(userId: string): Promise<UnreadNotificationCounts> {
    const unread = [...this.notifications.values()].filter((notification) => notification.userId === userId && notification.readAt === null);
    return summarizeUnreadCategories(unread.map((notification) => notification.category));
  }

  public async markOwnNotificationRead(userId: string, notificationId: string, readAt: Date): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    if (notification === undefined || notification.userId !== userId) return false;
    if (notification.readAt === null) this.notifications.set(notificationId, { ...notification, readAt });
    return true;
  }

  public async markAllOwnNotificationsRead(userId: string, readAt: Date): Promise<number> {
    let updated = 0;
    for (const notification of this.notifications.values()) {
      if (notification.userId !== userId || notification.readAt !== null) continue;
      this.notifications.set(notification.id, { ...notification, readAt });
      updated += 1;
    }
    return updated;
  }
}
