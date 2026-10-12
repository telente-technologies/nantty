import type { NewNotification, NotificationRepository, StoredNotification } from "../../../interfaces/repositories.interface.js";
import type { PrismaClient } from "../../../databases/prisma.database.js";
import type { ActorSummary } from "../../../types/notification.type.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildNotificationCreatedOutboxRow } from "../../../events/notificationCreated.event.js";

const contentReferenceKeys = ["postId", "originalPostId", "replyClipId", "originalClipId"] as const;

type Row = Awaited<ReturnType<PrismaClient["notification"]["findFirstOrThrow"]>>;

function convertRow(row: Row): StoredNotification {
  return {
    id: row.id, userId: row.userId, category: row.category, kind: row.kind, title: row.title, body: row.body,
    actor: row.actor as ActorSummary | null, data: row.data as Record<string, unknown>, readAt: row.readAt, createdAt: row.createdAt,
  };
}

export function encodeNotificationCursor(row: { readonly createdAt: Date; readonly id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");
}

function decodeNotificationCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [createdAt, id] = Buffer.from(cursor, "base64url").toString().split("|");
  const parsed = createdAt === undefined ? Number.NaN : Date.parse(createdAt);
  return id === undefined || Number.isNaN(parsed) ? null : { createdAt: new Date(parsed), id };
}

export class NotificationPrismaRepository implements NotificationRepository {
  public constructor(private readonly prisma: PrismaClient, private readonly webBaseUrl?: string) {}

  public async insertIfAbsent(notification: NewNotification): Promise<StoredNotification | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const row = await transaction.notification.create({
          data: { ...notification, actor: notification.actor === null ? Prisma.JsonNull : (notification.actor as unknown as Prisma.InputJsonValue), data: notification.data as Prisma.InputJsonValue },
        });
        const stored = convertRow(row);
        const event = buildNotificationCreatedOutboxRow(stored, this.webBaseUrl);
        await transaction.outboxEvent.create({ data: { id: event.id, eventType: event.eventType, subject: event.subject, payload: event.payload as Prisma.InputJsonValue } });
        return stored;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    }
  }

  public async findById(id: string): Promise<StoredNotification | null> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    return row === null ? null : convertRow(row);
  }

  public async findByDedupeKey(dedupeKey: string): Promise<StoredNotification | null> {
    const row = await this.prisma.notification.findUnique({ where: { dedupeKey } });
    return row === null ? null : convertRow(row);
  }

  public async list(userId: string, filter: "all" | "mentions", limit: number, cursor: string | null) {
    const position = cursor === null ? null : decodeNotificationCursor(cursor);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        hiddenAt: null,
        ...(filter === "mentions" ? { kind: "mention" } : {}),
        ...(position === null ? {} : { OR: [{ createdAt: { lt: position.createdAt } }, { createdAt: position.createdAt, id: { lt: position.id } }] }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit).map(convertRow);
    const last = page[page.length - 1];
    return { rows: page, nextCursor: rows.length > limit && last !== undefined ? encodeNotificationCursor(last) : null };
  }

  public async markRead(userId: string, notificationId: string, readAt: Date): Promise<boolean> {
    const owned = await this.prisma.notification.findFirst({ where: { id: notificationId, userId }, select: { id: true } });
    if (owned === null) return false;
    await this.prisma.notification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt } });
    return true;
  }

  public async markAllRead(userId: string, readAt: Date): Promise<number> {
    return (await this.prisma.notification.updateMany({ where: { userId, readAt: null, hiddenAt: null }, data: { readAt } })).count;
  }

  public countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null, hiddenAt: null } });
  }

  public async deleteForContent(contentId: string): Promise<number> {
    const references = contentReferenceKeys.map((key) => ({ data: { path: [key], equals: contentId } }));
    return (await this.prisma.notification.deleteMany({ where: { OR: references } })).count;
  }

  public async setHiddenForComment(commentId: string, hidden: boolean, at: Date): Promise<number> {
    const byComment = [{ data: { path: ["commentId"], equals: commentId } }, { data: { path: ["url"], string_ends_with: `?comment=${commentId}` } }];
    const where = { OR: byComment, hiddenAt: hidden ? null : { not: null } };
    return (await this.prisma.notification.updateMany({ where, data: { hiddenAt: hidden ? at : null } })).count;
  }
}
