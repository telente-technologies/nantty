import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { authorId, buildPostRow, viewerId } from "../posts/socialPostFakes.fake.js";

export const postId = "0192f0a0-0000-7000-8000-0000000000a1";
export const firstId = "0192f0a0-0000-7000-8000-0000000000b1";
export const secondId = "0192f0a0-0000-7000-8000-0000000000b2";
export const replyId = "0192f0a0-0000-7000-8000-0000000000b3";

type Row = Record<string, unknown>;

export interface PinStore {
  readonly posts: Row[];
  readonly comments: Row[];
  readonly events: { eventType: string; data: Row }[];
  readonly context: HandlerContext;
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
      const operators = condition as { in?: unknown[]; not?: unknown; startsWith?: string };
      if (operators.in !== undefined) return operators.in.includes(value);
      if ("not" in operators) return value !== operators.not;
      if (operators.startsWith !== undefined) return String(value).startsWith(operators.startsWith);
      return true;
    }
    return value === condition;
  });
}

function table(rows: Row[], withMedia: boolean) {
  const shape = (row: Row | undefined) => (row === undefined ? null : withMedia ? { ...row, media: [] } : row);
  return {
    findFirst: async ({ where }: { where: Row }) => shape(rows.find((row) => matches(row, where))),
    findUniqueOrThrow: async ({ where }: { where: Row }) => shape(rows.find((row) => matches(row, where))),
    findMany: async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where)).map(shape),
    count: async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where)).length,
    update: async ({ where, data }: { where: Row; data: Row }) => shape(Object.assign(rows.find((row) => matches(row, where)) as Row, data)),
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const hits = rows.filter((row) => matches(row, where));
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
    },
  };
}

export function buildComment(overrides: Row & { id: string }): Row {
  return {
    postId, parentCommentId: null, rootCommentId: null, authorId: viewerId, text: "Nice post", mentions: [], likeCount: 0, replyCount: 0, depth: 0, path: "",
    moderationVisibility: "visible", deletedAt: null, createdAt: new Date("2026-10-04T11:00:00Z"), isPinned: false, pinnedAt: null, ...overrides,
  };
}

export function createPinStore(comments: Row[], postOverrides: Row = {}): PinStore {
  const posts: Row[] = [{ ...buildPostRow({ id: postId, authorId }), isPinned: false, pinnedAt: null, pinnedCommentId: null, ...postOverrides }];
  const events: PinStore["events"] = [];
  const emptyList = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0 };
  const client: Row = new Proxy({
    post: table(posts, true),
    comment: table(comments, false),
    outboxEvent: { createMany: async ({ data }: { data: { eventType: string; payload: { data: Row } }[] }) => { events.push(...data.map((event) => ({ eventType: event.eventType, data: event.payload.data }))); } },
    $transaction: async (work: (db: unknown) => Promise<unknown>) => work(client),
  } as Row, { get: (target, key: string) => target[key] ?? emptyList });
  const context = {
    database: { client, transaction: async (work: (db: unknown) => Promise<unknown>) => work(client) },
    directory: {
      findUserSummaries: async (wanted: string[]) => new Map(wanted.map((id) => [id, { id, name: "User", username: "user", avatarUrl: null, verified: false, isCreator: false }])),
      findPrivateAccountIds: async () => new Set(),
    },
    clock: { now: () => new Date("2026-10-04T12:00:00Z") },
    premium: { isPremium: async () => false, hasSubscribedToCreator: async () => false },
  } as unknown as HandlerContext;
  return { posts, comments, events, context };
}
