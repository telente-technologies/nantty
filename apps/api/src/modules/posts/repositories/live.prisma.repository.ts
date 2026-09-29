import type { LiveSession } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { LiveCommentRecord, LiveSessionRecord } from "../models/posts.model.js";
import type { LiveSessionsRepository, NewLiveSessionInput } from "./live.repository.js";

function convertLiveRowToRecord(row: LiveSession): LiveSessionRecord {
  return {
    id: row.id,
    hostId: row.hostId,
    storeId: row.storeId,
    title: row.title,
    status: row.status === "ended" ? "ended" : "live",
    viewerCount: row.viewerCount,
    reactionCount: row.reactionCount,
    productIds: row.productIds,
    pinnedProductId: row.pinnedId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

export class PrismaLiveSessionsRepository implements LiveSessionsRepository {
  public async create(input: NewLiveSessionInput): Promise<LiveSessionRecord> {
    return convertLiveRowToRecord(await prisma().liveSession.create({ data: { ...input, productIds: [...input.productIds] } }));
  }

  public async findById(id: string): Promise<LiveSessionRecord | undefined> {
    const row = await prisma().liveSession.findUnique({ where: { id } });
    return row === null ? undefined : convertLiveRowToRecord(row);
  }

  public async listActive(page: PageRequest): Promise<Page<LiveSessionRecord>> {
    const rows = await prisma().liveSession.findMany({
      where: { status: "live" },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertLiveRowToRecord);
  }

  public async end(id: string, endedAt: Date): Promise<boolean> {
    const result = await prisma().liveSession.updateMany({ where: { id, status: "live" }, data: { status: "ended", endedAt, viewerCount: 0 } });
    await prisma().liveViewer.updateMany({ where: { sessionId: id, leftAt: null }, data: { leftAt: endedAt } });
    return result.count === 1;
  }

  public async addViewer(sessionId: string, userId: string, joinedAt: Date): Promise<LiveSessionRecord | undefined> {
    await prisma().liveViewer.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId, joinedAt },
      update: { joinedAt, leftAt: null },
    });
    return this.refreshViewerCount(sessionId);
  }

  public async removeViewer(sessionId: string, userId: string, leftAt: Date): Promise<LiveSessionRecord | undefined> {
    await prisma().liveViewer.updateMany({ where: { sessionId, userId, leftAt: null }, data: { leftAt } });
    return this.refreshViewerCount(sessionId);
  }

  public async addProduct(sessionId: string, productId: string, pin: boolean): Promise<LiveSessionRecord | undefined> {
    const session = await this.findById(sessionId);
    if (session === undefined) return undefined;
    const row = await prisma().liveSession.update({
      where: { id: sessionId },
      data: {
        productIds: [...new Set([...session.productIds, productId])],
        ...(pin ? { pinnedId: productId } : {}),
      },
    });
    return convertLiveRowToRecord(row);
  }

  public async createComment(sessionId: string, userId: string, text: string, createdAt: Date): Promise<LiveCommentRecord> {
    return prisma().liveComment.create({ data: { sessionId, userId, text, createdAt } });
  }

  public async listComments(sessionId: string, page: PageRequest): Promise<Page<LiveCommentRecord>> {
    const rows = await prisma().liveComment.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildPrismaPageArguments(page),
    });
    return buildPageFromFetchedRows(rows, page);
  }

  private async refreshViewerCount(sessionId: string): Promise<LiveSessionRecord | undefined> {
    const viewerCount = await prisma().liveViewer.count({ where: { sessionId, leftAt: null } });
    await prisma().liveSession.updateMany({ where: { id: sessionId, status: "live" }, data: { viewerCount } });
    return this.findById(sessionId);
  }

  public async addReaction(sessionId: string): Promise<LiveSessionRecord | undefined> {
    const result = await prisma().liveSession.updateMany({ where: { id: sessionId, status: "live" }, data: { reactionCount: { increment: 1 } } });
    return result.count === 0 ? undefined : this.findById(sessionId);
  }
}
