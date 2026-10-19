import { randomUUID } from "node:crypto";

import type { HandlerContext } from "../../src/types/handlerContext.type.js";

export type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const compoundKeys: Record<string, readonly string[]> = { blockerId_blockedId: ["blockerId", "blockedId"], followerId_followeeId: ["followerId", "followeeId"] };

function flatten(where: Where): Where {
  const flat: Where = {};
  for (const [key, value] of Object.entries(where)) {
    const parts = compoundKeys[key];
    if (parts !== undefined && value !== null && typeof value === "object") Object.assign(flat, value);
    else flat[key] = value;
  }
  return flat;
}

function compare(left: unknown, right: unknown): number {
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
}

export function matches(row: Row, rawWhere: Where = {}): boolean {
  const where = flatten(rawWhere);
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return (condition as Where[]).some((part) => matches(row, part));
    if (key === "AND") return (condition as Where[]).every((part) => matches(row, part));
    if (condition === undefined) return true;
    const value = row[key] ?? null;
    if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
      const ops = condition as Record<string, unknown>;
      if ("in" in ops && !(ops["in"] as unknown[]).includes(value)) return false;
      if ("notIn" in ops && (ops["notIn"] as unknown[]).includes(value)) return false;
      if ("not" in ops && value === ops["not"]) return false;
      if ("lt" in ops && !(value !== null && compare(value, ops["lt"]) < 0)) return false;
      if ("lte" in ops && !(value !== null && compare(value, ops["lte"]) <= 0)) return false;
      if ("gt" in ops && !(value !== null && compare(value, ops["gt"]) > 0)) return false;
      if ("startsWith" in ops && !String(value).startsWith(String(ops["startsWith"]))) return false;
      if ("contains" in ops && !String(value).toLowerCase().includes(String(ops["contains"]).toLowerCase())) return false;
      return true;
    }
    return value === condition;
  });
}

function sortRows(rows: Row[], orderBy: unknown): Row[] {
  const clauses = (Array.isArray(orderBy) ? orderBy : orderBy === undefined ? [] : [orderBy]) as Record<string, "asc" | "desc">[];
  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      for (const [field, direction] of Object.entries(clause)) {
        const result = compare(left[field], right[field]);
        if (result !== 0) return direction === "desc" ? -result : result;
      }
    }
    return 0;
  });
}

function applyUpdate(row: Row, data: Row): Row {
  for (const [key, value] of Object.entries(data)) {
    const increment = value !== null && typeof value === "object" && "increment" in value ? Number((value as { increment: unknown }).increment)
      : value !== null && typeof value === "object" && "decrement" in value ? -Number((value as { decrement: unknown }).decrement) : undefined;
    row[key] = increment === undefined ? value : Number(row[key] ?? 0) + increment;
  }
  return row;
}

export function memoryTable(rows: Row[], withMedia = false, defaults: () => Row = () => ({}), resolve: (where: Where | undefined) => Where | undefined = (where) => where) {
  const shape = (row: Row | undefined) => (row === undefined ? null : withMedia ? { media: [], ...row } : row);
  const findMany = async (args: { where?: Where; orderBy?: unknown; take?: number; distinct?: string[] } = {}) => {
    let found = sortRows(rows.filter((row) => matches(row, resolve(args.where))), args.orderBy);
    if (args.distinct !== undefined) {
      const seen = new Set<string>();
      found = found.filter((row) => { const key = args.distinct!.map((field) => String(row[field])).join("|"); return seen.has(key) ? false : (seen.add(key), true); });
    }
    return found.slice(0, args.take ?? found.length).map(shape);
  };
  return {
    rows,
    findMany,
    findFirst: async (args: { where?: Where; orderBy?: unknown } = {}) => shape(sortRows(rows.filter((row) => matches(row, args.where)), args.orderBy)[0]),
    findUnique: async ({ where }: { where: Where }) => shape(rows.find((row) => matches(row, where))),
    count: async ({ where }: { where?: Where } = {}) => rows.filter((row) => matches(row, where)).length,
    create: async ({ data }: { data: Row }) => {
      const nested = (data["media"] as { create?: Row[] } | undefined)?.create;
      const row = { ...defaults(), id: randomUUID(), createdAt: new Date(), ...data, ...(withMedia ? { media: nested ?? [] } : {}) };
      rows.push(row);
      return shape(row);
    },
    createMany: async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => {
      const fresh = skipDuplicates === true ? data.filter((candidate) => !rows.some((row) => Object.entries(candidate).every(([key, value]) => row[key] === value))) : data;
      rows.push(...fresh.map((row) => ({ ...defaults(), id: randomUUID(), createdAt: new Date(), ...row })));
      return { count: fresh.length };
    },
    update: async ({ where, data }: { where: Where; data: Row }) => shape(applyUpdate(rows.find((row) => matches(row, where)) as Row, data)),
    upsert: async ({ where, create, update }: { where: Where; create: Row; update: Row }) => {
      const existing = rows.find((row) => matches(row, where));
      if (existing !== undefined) return shape(applyUpdate(existing, update));
      const row = { ...defaults(), id: randomUUID(), createdAt: new Date(), ...create };
      rows.push(row);
      return shape(row);
    },
    updateMany: async ({ where, data }: { where: Where; data: Row }) => { const hits = rows.filter((row) => matches(row, where)); for (const row of hits) applyUpdate(row, data); return { count: hits.length }; },
    deleteMany: async ({ where }: { where?: Where } = {}) => { const before = rows.length; for (let index = rows.length - 1; index >= 0; index -= 1) if (matches(rows[index] as Row, where)) rows.splice(index, 1); return { count: before - rows.length }; },
  };
}

function resolveCommentRelations(store: { posts: Row[]; comments: Row[] }, where: Where | undefined): Where | undefined {
  if (where === undefined || (!("post" in where) && !("replies" in where))) return where;
  const { post, replies, ...rest } = where as Where & { post?: Where; replies?: { none: Where } };
  const extra: Where[] = [];
  if (post !== undefined) extra.push({ postId: { in: store.posts.filter((row) => matches(row, post)).map((row) => row["id"]) } });
  if (replies !== undefined) extra.push({ id: { notIn: store.comments.filter((row) => matches(row, replies.none)).map((row) => row["parentCommentId"]) } });
  return { ...rest, AND: [...((rest["AND"] as Where[] | undefined) ?? []), ...extra] };
}

export interface MemoryStore {
  readonly posts: Row[];
  readonly comments: Row[];
  readonly blocks: Row[];
  readonly follows: Row[];
  readonly snapshots: Row[];
  readonly postMutes: Row[];
  readonly events: Row[];
  readonly privateAccountIds: Set<string>;
  readonly context: HandlerContext;
  now: Date;
}

export function createMemoryStore(seed: { posts?: Row[]; comments?: Row[]; postDefaults?: () => Row; commentDefaults?: () => Row } = {}): MemoryStore {
  const store = { posts: seed.posts ?? [], comments: seed.comments ?? [], blocks: [] as Row[], follows: [] as Row[], snapshots: [] as Row[], postMutes: [] as Row[], events: [] as Row[], privateAccountIds: new Set<string>(), now: new Date("2026-10-10T12:00:00Z") } as MemoryStore;
  const tables: Row = {
    post: memoryTable(store.posts, true, seed.postDefaults),
    comment: memoryTable(store.comments, false, seed.commentDefaults, (where) => resolveCommentRelations(store, where)),
    block: memoryTable(store.blocks),
    follow: memoryTable(store.follows),
    commentRankSnapshot: memoryTable(store.snapshots),
    postNotificationMute: memoryTable(store.postMutes),
    outboxEvent: memoryTable(store.events),
  };
  const empty = memoryTable([]);
  const client: Row = new Proxy(tables, { get: (target, key: string) => target[key] ?? empty });
  (store as { context: HandlerContext }).context = {
    database: { client, transaction: async (work: (db: unknown) => Promise<unknown>) => work(client) },
    directory: {
      findUserSummaries: async (ids: string[]) => new Map(ids.map((id) => [id, { id, name: `User ${id.slice(-4)}`, username: `user${id.slice(-4)}`, avatarUrl: null, verified: false, isCreator: false }])),
      findPrivateAccountIds: async (ids: string[]) => new Set(ids.filter((id) => store.privateAccountIds.has(id))),
    },
    clock: { now: () => store.now },
    premium: { isPremium: async () => false, hasSubscribedToCreator: async () => false },
  } as unknown as HandlerContext;
  return store;
}
