import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { LiveCommentRecord, LiveSessionRecord } from "../models/posts.model.js";

export interface NewLiveSessionInput {
  readonly hostId: string;
  readonly storeId: string | null;
  readonly title: string;
  readonly productIds: readonly string[];
  readonly startedAt: Date;
}

export interface LiveSessionsRepository {
  create(input: NewLiveSessionInput): Promise<LiveSessionRecord>;
  findById(id: string): Promise<LiveSessionRecord | undefined>;
  listActive(page: PageRequest): Promise<Page<LiveSessionRecord>>;
  end(id: string, endedAt: Date): Promise<boolean>;
  addViewer(sessionId: string, userId: string, joinedAt: Date): Promise<LiveSessionRecord | undefined>;
  removeViewer(sessionId: string, userId: string, leftAt: Date): Promise<LiveSessionRecord | undefined>;
  addProduct(sessionId: string, productId: string, pin: boolean): Promise<LiveSessionRecord | undefined>;
  createComment(sessionId: string, userId: string, text: string, createdAt: Date): Promise<LiveCommentRecord>;
  listComments(sessionId: string, page: PageRequest): Promise<Page<LiveCommentRecord>>;
}

export class InMemoryLiveSessionsRepository implements LiveSessionsRepository {
  private readonly sessions = new Map<string, LiveSessionRecord & { createdAt: Date }>();
  private readonly viewers = new Map<string, Set<string>>();
  private readonly comments: LiveCommentRecord[] = [];

  public async create(input: NewLiveSessionInput): Promise<LiveSessionRecord> {
    const session = { ...input, id: randomUUID(), status: "live" as const, viewerCount: 0, pinnedProductId: null, endedAt: null, createdAt: input.startedAt };
    this.sessions.set(session.id, session);
    this.viewers.set(session.id, new Set());
    return session;
  }

  public async findById(id: string): Promise<LiveSessionRecord | undefined> {
    return this.sessions.get(id);
  }

  public async listActive(page: PageRequest): Promise<Page<LiveSessionRecord>> {
    const active = [...this.sessions.values()].filter((session) => session.status === "live").sort(compareByNewestFirst);
    return paginateSortedItems(active, page);
  }

  public async end(id: string, endedAt: Date): Promise<boolean> {
    const session = this.sessions.get(id);
    if (session === undefined || session.status !== "live") return false;
    this.sessions.set(id, { ...session, status: "ended", endedAt, viewerCount: 0 });
    this.viewers.get(id)?.clear();
    return true;
  }

  public async addViewer(sessionId: string, userId: string): Promise<LiveSessionRecord | undefined> {
    this.viewers.get(sessionId)?.add(userId);
    return this.refreshViewerCount(sessionId);
  }

  public async removeViewer(sessionId: string, userId: string): Promise<LiveSessionRecord | undefined> {
    this.viewers.get(sessionId)?.delete(userId);
    return this.refreshViewerCount(sessionId);
  }

  public async addProduct(sessionId: string, productId: string, pin: boolean): Promise<LiveSessionRecord | undefined> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return undefined;
    const updated = {
      ...session,
      productIds: [...new Set([...session.productIds, productId])],
      pinnedProductId: pin ? productId : session.pinnedProductId,
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  public async createComment(sessionId: string, userId: string, text: string, createdAt: Date): Promise<LiveCommentRecord> {
    const comment = { id: randomUUID(), sessionId, userId, text, createdAt };
    this.comments.push(comment);
    return comment;
  }

  public async listComments(sessionId: string, page: PageRequest): Promise<Page<LiveCommentRecord>> {
    return paginateSortedItems(this.comments.filter((comment) => comment.sessionId === sessionId).sort(compareByNewestFirst), page);
  }

  private refreshViewerCount(sessionId: string): LiveSessionRecord | undefined {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return undefined;
    const updated = { ...session, viewerCount: this.viewers.get(sessionId)?.size ?? 0 };
    this.sessions.set(sessionId, updated);
    return updated;
  }
}
