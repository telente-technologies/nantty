import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { Prisma, Product } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type {
  NewProductInput,
  PriceRange,
  ProductChanges,
  ProductRecord,
  ProductSort,
  ProductStatus,
  PublicProductFilter,
} from "../models/products.model.js";
import type { ProductsRepository } from "./products.repository.js";

function convertProductRowToRecord(row: Product): ProductRecord {
  const { ratingAvg, price, compareAtPrice, status, currency, ...rest } = row;
  return {
    ...rest,
    status: status as ProductStatus,
    currency: currency as CurrencyCode,
    price: convertDatabaseAmountToMinorUnits(price),
    compareAtPrice: compareAtPrice === null ? null : convertDatabaseAmountToMinorUnits(compareAtPrice),
    ratingAverage: ratingAvg,
  };
}

function buildProductOrdering(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "price_asc") return [{ price: "asc" }, { id: "asc" }];
  if (sort === "price_desc") return [{ price: "desc" }, { id: "desc" }];
  if (sort === "popular") return [{ salesCount: "desc" }, { createdAt: "desc" }, { id: "desc" }];
  return [{ createdAt: "desc" }, { id: "desc" }];
}

function buildPriceRangeWhere(range: PriceRange): Prisma.ProductWhereInput {
  return {
    currency: range.currency,
    price: { ...(range.minPrice === undefined ? {} : { gte: range.minPrice }), ...(range.maxPrice === undefined ? {} : { lte: range.maxPrice }) },
  };
}

function buildPublishedWhere(excludedStoreIds: readonly string[]): Prisma.ProductWhereInput {
  return { status: "published", ...(excludedStoreIds.length === 0 ? {} : { storeId: { notIn: [...excludedStoreIds] } }) };
}

export class PrismaProductsRepository implements ProductsRepository {
  public async create(input: NewProductInput): Promise<ProductRecord> {
    return convertProductRowToRecord(await prisma().product.create({ data: { ...input, images: [...input.images] } }));
  }

  public async findById(id: string): Promise<ProductRecord | undefined> {
    const row = await prisma().product.findUnique({ where: { id } });
    return row === null ? undefined : convertProductRowToRecord(row);
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly ProductRecord[]> {
    return (await prisma().product.findMany({ where: { id: { in: [...ids] } } })).map(convertProductRowToRecord);
  }

  public async update(id: string, changes: ProductChanges): Promise<ProductRecord | undefined> {
    const { images, ...rest } = changes;
    const result = await prisma().product.updateMany({ where: { id }, data: { ...rest, ...(images === undefined ? {} : { images: [...images] }) } });
    return result.count === 0 ? undefined : this.findById(id);
  }

  public async updateStatus(id: string, status: ProductStatus, publishedAt: Date | null): Promise<ProductRecord | undefined> {
    const result = await prisma().product.updateMany({ where: { id }, data: { status, publishedAt } });
    return result.count === 0 ? undefined : this.findById(id);
  }

  public async listPublished(filter: PublicProductFilter, page: PageRequest): Promise<Page<ProductRecord>> {
    const rows = await prisma().product.findMany({
      where: {
        ...buildPublishedWhere(filter.excludedStoreIds),
        ...(filter.categoryId === undefined ? {} : { categoryId: filter.categoryId }),
        ...(filter.storeId === undefined ? {} : { storeId: filter.storeId }),
        AND: [
          ...(filter.priceRanges === undefined ? [] : [{ OR: filter.priceRanges.map(buildPriceRangeWhere) }]),
          ...(filter.search === undefined
            ? []
            : [{ OR: [{ title: { contains: filter.search, mode: "insensitive" as const } }, { description: { contains: filter.search, mode: "insensitive" as const } }] }]),
        ],
      },
      orderBy: buildProductOrdering(filter.sort),
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertProductRowToRecord);
  }

  public async listForStore(storeId: string, page: PageRequest): Promise<Page<ProductRecord>> {
    const rows = await prisma().product.findMany({
      where: { storeId, status: { not: "archived" } },
      orderBy: buildProductOrdering("newest"),
      ...buildPrismaPageArguments(page),
    });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertProductRowToRecord);
  }

  public async listAllActiveForStore(storeId: string): Promise<readonly ProductRecord[]> {
    const rows = await prisma().product.findMany({ where: { storeId, status: { not: "archived" } }, orderBy: { title: "asc" } });
    return rows.map(convertProductRowToRecord);
  }

  public async listDiscountedPublished(excludedStoreIds: readonly string[], limit: number): Promise<readonly ProductRecord[]> {
    const rows = await prisma().product.findMany({
      where: { ...buildPublishedWhere(excludedStoreIds), compareAtPrice: { not: null } },
      orderBy: buildProductOrdering("newest"),
      take: limit,
    });
    return rows.map(convertProductRowToRecord);
  }

  public async listRelatedPublished(product: ProductRecord, excludedStoreIds: readonly string[], limit: number): Promise<readonly ProductRecord[]> {
    const rows = await prisma().product.findMany({
      where: {
        ...buildPublishedWhere(excludedStoreIds),
        id: { not: product.id },
        OR: [{ storeId: product.storeId }, ...(product.categoryId === null ? [] : [{ categoryId: product.categoryId }])],
      },
      orderBy: buildProductOrdering("popular"),
      take: limit,
    });
    return rows.map(convertProductRowToRecord);
  }

  public countPublishedForStore(storeId: string): Promise<number> {
    return prisma().product.count({ where: { storeId, status: "published" } });
  }

  public countAllForStore(storeId: string): Promise<number> {
    return prisma().product.count({ where: { storeId } });
  }

  public async incrementSalesCount(id: string, quantity: number): Promise<void> {
    await prisma().product.updateMany({ where: { id }, data: { salesCount: { increment: quantity } } });
  }

  public async updateRating(id: string, ratingAverage: number, ratingCount: number): Promise<void> {
    await prisma().product.updateMany({ where: { id }, data: { ratingAvg: ratingAverage, ratingCount } });
  }
}
