import { randomUUID } from "node:crypto";

import { prisma } from "../../../integrations/database.integration.js";
import type { CartItemRecord } from "../models/carts.model.js";

export interface CartsRepository {
  listForUser(userId: string): Promise<readonly CartItemRecord[]>;
  findLine(userId: string, variantId: string): Promise<CartItemRecord | undefined>;
  saveLineQuantity(userId: string, variantId: string, quantity: number): Promise<CartItemRecord>;
  removeLine(userId: string, variantId: string): Promise<boolean>;
  removeLines(userId: string, variantIds: readonly string[]): Promise<void>;
  clear(userId: string): Promise<void>;
}

export class InMemoryCartsRepository implements CartsRepository {
  private readonly lines = new Map<string, CartItemRecord>();

  public async listForUser(userId: string): Promise<readonly CartItemRecord[]> {
    return [...this.lines.values()].filter((line) => line.userId === userId);
  }

  public async findLine(userId: string, variantId: string): Promise<CartItemRecord | undefined> {
    return this.lines.get(`${userId}:${variantId}`);
  }

  public async saveLineQuantity(userId: string, variantId: string, quantity: number): Promise<CartItemRecord> {
    const key = `${userId}:${variantId}`;
    const existing = this.lines.get(key);
    const line: CartItemRecord = existing === undefined
      ? { id: randomUUID(), userId, variantId, quantity, createdAt: new Date() }
      : { ...existing, quantity };
    this.lines.set(key, line);
    return line;
  }

  public async removeLine(userId: string, variantId: string): Promise<boolean> {
    return this.lines.delete(`${userId}:${variantId}`);
  }

  public async removeLines(userId: string, variantIds: readonly string[]): Promise<void> {
    for (const variantId of variantIds) this.lines.delete(`${userId}:${variantId}`);
  }

  public async clear(userId: string): Promise<void> {
    for (const line of await this.listForUser(userId)) this.lines.delete(`${userId}:${line.variantId}`);
  }
}

export class PrismaCartsRepository implements CartsRepository {
  public listForUser(userId: string): Promise<readonly CartItemRecord[]> {
    return prisma().cartItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  }

  public async findLine(userId: string, variantId: string): Promise<CartItemRecord | undefined> {
    return (await prisma().cartItem.findUnique({ where: { userId_variantId: { userId, variantId } } })) ?? undefined;
  }

  public saveLineQuantity(userId: string, variantId: string, quantity: number): Promise<CartItemRecord> {
    return prisma().cartItem.upsert({
      where: { userId_variantId: { userId, variantId } },
      create: { userId, variantId, quantity },
      update: { quantity },
    });
  }

  public async removeLine(userId: string, variantId: string): Promise<boolean> {
    return (await prisma().cartItem.deleteMany({ where: { userId, variantId } })).count > 0;
  }

  public async removeLines(userId: string, variantIds: readonly string[]): Promise<void> {
    await prisma().cartItem.deleteMany({ where: { userId, variantId: { in: [...variantIds] } } });
  }

  public async clear(userId: string): Promise<void> {
    await prisma().cartItem.deleteMany({ where: { userId } });
  }
}
