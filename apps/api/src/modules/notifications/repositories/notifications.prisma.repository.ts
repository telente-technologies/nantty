import type { Notification } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { NotificationCategory } from "../../../events/notificationRequested.event.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { NewNotification, NotificationFilter, NotificationRecord, UnreadNotificationCounts } from "../models/notifications.model.js";
import { summarizeUnreadCategories, type NotificationsRepository } from "./notifications.repository.js";

function convertNotificationRowToRecord(row: Notification): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category as NotificationCategory,
    title: row.title,
    body: row.body,
    data: (row.data ?? {}) as Record<string, string>,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export class PrismaNotificationsRepository implements NotificationsRepository {
  public async create(notification: NewNotification, createdAt: Date): Promise<NotificationRecord> {
    const row = await prisma().notification.create({ data: { ...notification, data: { ...notification.data }, createdAt } });
    return convertNotificationRowToRecord(row);
  }

  public async listForUser(userId: string, filter: NotificationFilter, page: PageRequest): Promise<Page<NotificationRecord>> {
    const rows = await prisma().notification.findMany({
      where: {
        userId,
        ...(filter.categories === undefined ? {} : { category: { in: [...filter.categories] } }),
        ...(filter.unreadOnly === true ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertNotificationRowToRecord);
  }

  public async countUnreadForUser(userId: string): Promise<UnreadNotificationCounts> {
    const groups = await prisma().notification.groupBy({ by: ["category"], where: { userId, readAt: null }, _count: { _all: true } });
    return summarizeUnreadCategories(groups.flatMap((group) => Array<NotificationCategory>(group._count._all).fill(group.category as NotificationCategory)));
  }

  public async markOwnNotificationRead(userId: string, notificationId: string, readAt: Date): Promise<boolean> {
    const owned = await prisma().notification.findFirst({ where: { id: notificationId, userId }, select: { id: true } });
    if (owned === null) return false;
    await prisma().notification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt } });
    return true;
  }

  public async markAllOwnNotificationsRead(userId: string, readAt: Date): Promise<number> {
    const result = await prisma().notification.updateMany({ where: { userId, readAt: null }, data: { readAt } });
    return result.count;
  }
}
