import { randomUUID } from "node:crypto";

import type { CartItem } from "../../../generated/prisma/client.js";
import type { SaleAttributionSource } from "../../../interfaces/orderLookup.interface.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { CartItemRecord, SaleAttribution } from "../models/carts.model.js";

export interface CartsRepository {
  listForUser(userId: string): Promise<readonly CartItemRecord[]>;
  findLine(userId: string, variantId: string): Promise<CartItemRecord | undefined>;
  saveLineQuantity(userId: string, variantId: string, quantity: number, attribution?: SaleAttribution): Promise<CartItemRecord>;
  removeLine(userId: string, variantId: string): Promise<boolean>;
  removeLines(userId: string, variantIds: readonly string[]): Promise<void>;
  clear(userId: string): Promise<void>;
}

function convertAttributionToColumns(attribution: SaleAttribution | undefined) {
  return attribution === undefined ? {} : { attributionSource: attribution.source, attributionId: attribution.id };
}

function convertCartRowToRecord(row: CartItem): CartItemRecord {
  return { ...row, attributionSource: row.attributionSource as SaleAttributionSource | null };
}

export class InMemoryCartsRepository implements CartsRepository {
  private readonly lines = new Map<string, CartItemRecord>();

  public async listForUser(userId: string): Promise<readonly CartItemRecord[]> {
    return [...this.lines.values()].filter((line) => line.userId === userId);
  }

  public async findLine(userId: string, variantId: string): Promise<CartItemRecord | undefined> {
    return this.lines.get(`${userId}:${variantId}`);
  }

  public async saveLineQuantity(userId: string, variantId: string, quantity: number, attribution?: SaleAttribution): Promise<CartItemRecord> {
    const key = `${userId}:${variantId}`;
    const existing = this.lines.get(key);
    const line: CartItemRecord = existing === undefined
      ? { id: randomUUID(), userId, variantId, quantity, attributionSource: null, attributionId: null, createdAt: new Date(), ...convertAttributionToColumns(attribution) }
      : { ...existing, quantity, ...convertAttributionToColumns(attribution) };
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
  public async listForUser(userId: string): Promise<readonly CartItemRecord[]> {
    return (await prisma().cartItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })).map(convertCartRowToRecord);
  }

  public async findLine(userId: string, variantId: string): Promise<CartItemRecord | undefined> {
    const row = await prisma().cartItem.findUnique({ where: { userId_variantId: { userId, variantId } } });
    return row === null ? undefined : convertCartRowToRecord(row);
  }

  public async saveLineQuantity(userId: string, variantId: string, quantity: number, attribution?: SaleAttribution): Promise<CartItemRecord> {
    const columns = convertAttributionToColumns(attribution);
    return convertCartRowToRecord(await prisma().cartItem.upsert({
      where: { userId_variantId: { userId, variantId } },
      create: { userId, variantId, quantity, ...columns },
      update: { quantity, ...columns },
    }));
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
