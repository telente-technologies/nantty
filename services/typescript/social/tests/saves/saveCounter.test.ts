import { describe, expect, it } from "vitest";

import { savedItemRepository } from "../../src/modules/saves/repositories/savedItem.repository.js";
import type { Db } from "../../src/types/database.type.js";

interface Row {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly targetId: string;
}

function fakeDatabase() {
  const saved: Row[] = [];
  const postSaveCounts = new Map<string, number>([["post-1", 0]]);
  const productCounts = new Map<string, number>();
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => value === undefined || (row as unknown as Record<string, unknown>)[key] === value);
  const db = {
    savedItem: {
      findUnique: async ({ where }: { where: { userId_type_targetId: Omit<Row, "id"> } }) => saved.find((row) => matches(row, where.userId_type_targetId)) ?? null,
      create: async ({ data }: { data: Omit<Row, "id"> }) => {
        const row = { id: `s${saved.length + 1}`, ...data };
        saved.push(row);
        return row;
      },
      update: async () => undefined,
      findMany: async ({ where }: { where: Record<string, unknown> }) => saved.filter((row) => matches(row, where)),
      deleteMany: async ({ where }: { where: { id: string } }) => {
        const index = saved.findIndex((row) => row.id === where.id);
        if (index >= 0) saved.splice(index, 1);
        return { count: index >= 0 ? 1 : 0 };
      },
    },
    post: {
      updateMany: async ({ where, data }: { where: { id: string; saveCount?: { gte: number } }; data: { saveCount: { increment?: number; decrement?: number } } }) => {
        const current = postSaveCounts.get(where.id);
        if (current === undefined || (where.saveCount !== undefined && current < where.saveCount.gte)) return { count: 0 };
        postSaveCounts.set(where.id, current + (data.saveCount.increment ?? 0) - (data.saveCount.decrement ?? 0));
        return { count: 1 };
      },
    },
    saveCounter: {
      upsert: async ({ where, update, create }: { where: { type_targetId: { targetId: string } }; update: { count: { increment: number } }; create: { count: number } }) =>
        productCounts.set(where.type_targetId.targetId, (productCounts.get(where.type_targetId.targetId) ?? 0) + (productCounts.has(where.type_targetId.targetId) ? update.count.increment : create.count)),
      updateMany: async ({ where, data }: { where: { targetId: string; count: { gte: number } }; data: { count: { decrement: number } } }) => {
        const current = productCounts.get(where.targetId) ?? 0;
        if (current < where.count.gte) return { count: 0 };
        productCounts.set(where.targetId, current - data.count.decrement);
        return { count: 1 };
      },
    },
  };
  return { db: db as unknown as Db, postSaveCounts, productCounts };
}

describe("save counters", () => {
  it("counts each saver once and never goes below zero", async () => {
    const { db, postSaveCounts } = fakeDatabase();
    expect(await savedItemRepository.saveAndCount(db, "u1", "post", "post-1", undefined)).toBe(true);
    expect(await savedItemRepository.saveAndCount(db, "u1", "post", "post-1", undefined)).toBe(false);
    expect(await savedItemRepository.saveAndCount(db, "u2", "clip", "post-1", undefined)).toBe(true);
    expect(postSaveCounts.get("post-1")).toBe(2);
    expect(await savedItemRepository.unsaveAndCount(db, "u1", undefined, "post-1")).toBe(1);
    expect(await savedItemRepository.unsaveAndCount(db, "u1", undefined, "post-1")).toBe(0);
    expect(postSaveCounts.get("post-1")).toBe(1);
  });

  it("keeps product save counts in the counter table", async () => {
    const { db, productCounts } = fakeDatabase();
    await savedItemRepository.saveAndCount(db, "u1", "product", "prod-9", undefined);
    await savedItemRepository.saveAndCount(db, "u2", "product", "prod-9", undefined);
    await savedItemRepository.unsaveAndCount(db, "u2", "product", "prod-9");
    expect(productCounts.get("prod-9")).toBe(1);
  });
});
