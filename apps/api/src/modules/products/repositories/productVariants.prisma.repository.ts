import type { ProductVariant } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import type { NewVariantInput, ProductVariantRecord, VariantChanges } from "../models/products.model.js";
import type { ProductVariantsRepository } from "./productVariants.repository.js";

function convertVariantRowToRecord(row: ProductVariant): ProductVariantRecord {
  return { ...row, price: convertDatabaseAmountToMinorUnits(row.price) };
}

export class PrismaProductVariantsRepository implements ProductVariantsRepository {
  public async createMany(productId: string, variants: readonly NewVariantInput[]): Promise<readonly ProductVariantRecord[]> {
    const rows = await prisma().$transaction(variants.map((variant) => prisma().productVariant.create({ data: { ...variant, productId } })));
    return rows.map(convertVariantRowToRecord);
  }

  public async findById(id: string): Promise<ProductVariantRecord | undefined> {
    const row = await prisma().productVariant.findUnique({ where: { id } });
    return row === null ? undefined : convertVariantRowToRecord(row);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly ProductVariantRecord[]> {
    return (await prisma().productVariant.findMany({ where: { id: { in: [...ids] } } })).map(convertVariantRowToRecord);
  }

  public async listForProducts(productIds: readonly string[]): Promise<readonly ProductVariantRecord[]> {
    const rows = await prisma().productVariant.findMany({ where: { productId: { in: [...productIds] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map(convertVariantRowToRecord);
  }

  public async update(id: string, changes: VariantChanges): Promise<ProductVariantRecord | undefined> {
    const result = await prisma().productVariant.updateMany({ where: { id }, data: { ...changes } });
    return result.count === 0 ? undefined : this.findById(id);
  }

  public async adjustStockBy(id: string, delta: number): Promise<ProductVariantRecord | undefined> {
    const result = await prisma().productVariant.updateMany({
      where: { id, ...(delta < 0 ? { stock: { gte: -delta } } : {}) },
      data: { stock: { increment: delta } },
    });
    return result.count === 0 ? undefined : this.findById(id);
  }

  public async decrementStockIfAvailable(id: string, quantity: number): Promise<boolean> {
    const result = await prisma().productVariant.updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
    return result.count === 1;
  }

  public async incrementStock(id: string, quantity: number): Promise<void> {
    await prisma().productVariant.updateMany({ where: { id }, data: { stock: { increment: quantity } } });
  }
}
