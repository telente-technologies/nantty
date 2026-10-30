import { randomUUID } from "node:crypto";

import type { MediaDatabase } from "../../src/databases/prisma.database.js";

type Row = Record<string, unknown> & { id: string };

function matches(row: Row, where: Record<string, unknown> | undefined): boolean {
  return Object.entries(where ?? {}).every(([field, condition]) => {
    const value = row[field];
    if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
      const operators = condition as Record<string, unknown>;
      if ("in" in operators) return (operators["in"] as unknown[]).includes(value);
      if ("lte" in operators) return value instanceof Date && value <= (operators["lte"] as Date);
      if ("not" in operators) return value !== operators["not"];
      return true;
    }
    return value === condition;
  });
}

export class FakeMediaDatabase {
  public readonly assets = new Map<string, Row>();
  public readonly variants: Row[] = [];
  public readonly outbox: Row[] = [];
  public readonly sessions = new Map<string, Row>();
  public readonly downloadVariants: Row[] = [];
  public readonly accessLogs: Row[] = [];

  public readonly client = {
    mediaAsset: {
      create: async ({ data }: { data: Row }) => this.insertAsset(data),
      findUnique: async ({ where }: { where: { id: string } }) => this.withVariants(this.assets.get(where.id)),
      findMany: async ({ where }: { where?: Record<string, unknown> }) => [...this.assets.values()].filter((row) => matches(row, where)).map((row) => this.withVariants(row)),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = this.assets.get(where.id);
        if (row === undefined) throw new Error("asset missing");
        Object.assign(row, data);
        return this.withVariants(row);
      },
    },
    uploadSession: {
      create: async ({ data }: { data: Row }) => {
        const row = { status: "uploading", mode: "multipart", s3UploadId: null, idempotencyKey: null, completedAt: null, ...data, id: randomUUID() } as unknown as Row;
        this.sessions.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id?: string; mediaId?: string } }) => [...this.sessions.values()].find((row) => (where.id !== undefined ? row.id === where.id : row["mediaId"] === where.mediaId)) ?? null,
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...this.sessions.values()].find((row) => matches(row, where)) ?? null,
      count: async ({ where }: { where: { ownerId: string; status: string } }) => [...this.sessions.values()].filter((row) => row["ownerId"] === where.ownerId && row["status"] === where.status).length,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(this.sessions.get(where.id) as Row, data),
    },
    mediaVariant: {
      deleteMany: async ({ where }: { where: { assetId: string } }) => {
        for (let index = this.variants.length - 1; index >= 0; index -= 1) if (this.variants[index]?.["assetId"] === where.assetId) this.variants.splice(index, 1);
      },
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        for (const entry of data) this.variants.push({ id: randomUUID(), ...entry });
      },
    },
    mediaDownloadVariant: {
      findUnique: async ({ where }: { where: { id?: string; assetId_cacheKey?: { assetId: string; cacheKey: string } } }) =>
        this.downloadVariants.find((row) => (where.id !== undefined ? row.id === where.id : row["assetId"] === where.assetId_cacheKey?.assetId && row["cacheKey"] === where.assetId_cacheKey?.cacheKey)) ?? null,
      findMany: async ({ where }: { where?: Record<string, unknown> }) => this.downloadVariants.filter((row) => matches(row, where)),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: randomUUID(), status: "pending", bucket: null, key: null, contentType: null, sizeBytes: null, attempts: 0, failureReason: null, startedAt: null, readyAt: null, createdAt: new Date(), ...data } as Row;
        this.downloadVariants.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = this.downloadVariants.find((candidate) => candidate.id === where.id);
        if (row === undefined) throw new Error("download variant missing");
        for (const [field, value] of Object.entries(data)) row[field] = value !== null && typeof value === "object" && "increment" in value ? (row[field] as number) + (value as { increment: number }).increment : value;
        return { ...row };
      },
      deleteMany: async ({ where }: { where: { assetId: string } }) => {
        for (let index = this.downloadVariants.length - 1; index >= 0; index -= 1) if (this.downloadVariants[index]?.["assetId"] === where.assetId) this.downloadVariants.splice(index, 1);
      },
    },
    mediaAccessLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: randomUUID(), ...data } as Row;
        this.accessLogs.push(row);
        return row;
      },
    },
    outboxEvent: {
      count: async () => this.outbox.length,
      createMany: async ({ data }: { data: Row[] }) => {
        this.outbox.push(...data);
      },
    },
  };

  public readonly database = {
    client: this.client,
    transaction: async <T>(work: (transaction: unknown) => Promise<T>) => work(this.client),
    disconnect: async () => undefined,
  } as unknown as MediaDatabase;

  public insertAsset(data: Record<string, unknown>): Row {
    const row = { status: "uploading", isPrivate: false, width: 0, height: 0, durationSeconds: null, pageCount: null, blurhash: null, posterKey: null, hlsKey: null, scanResult: null, moderationScore: null, moderationDecision: null, rejectionReason: null, expiresAt: null, deletedAt: null, sha256: null, sniffedMimeType: null, ...data } as unknown as Row;
    this.assets.set(row.id, row);
    return row;
  }

  public eventTypes(): string[] {
    return this.outbox.map((event) => event["eventType"] as string);
  }

  private withVariants(row: Row | undefined) {
    return row === undefined ? null : { ...row, variants: this.variants.filter((variant) => variant["assetId"] === row.id) };
  }
}
