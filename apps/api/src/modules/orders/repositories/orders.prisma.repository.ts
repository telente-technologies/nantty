import type { Checkout, Order, OrderItem, Prisma } from "../../../generated/prisma/client.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { OrderStatus } from "../../../enums/orderStatus.enum.js";
import type { SaleAttributionSource } from "../../../interfaces/orderLookup.interface.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { convertDatabaseAmountToMinorUnits } from "../../../utils/money.util.js";
import { buildPageFromFetchedRows, buildPrismaPageArguments, mapPageItems } from "../../../utils/pagination.util.js";
import type { CheckoutRecord, CheckoutStatus, NewOrder, OrderRecord, OrderStatusChange, ShippingAddressSnapshot } from "../models/orders.model.js";
import type { OrdersRepository } from "./orders.repository.js";

function convertCheckoutRowToRecord(row: Checkout): CheckoutRecord {
  return { ...row, total: convertDatabaseAmountToMinorUnits(row.total), currency: row.currency as CurrencyCode, status: row.status as CheckoutStatus };
}

function convertOrderRowToRecord(row: Order & { items: OrderItem[] }): OrderRecord {
  return {
    ...row,
    status: row.status as OrderStatus,
    currency: row.currency as CurrencyCode,
    chargeCurrency: row.chargeCurrency as CurrencyCode,
    chargeTotal: convertDatabaseAmountToMinorUnits(row.chargeTotal),
    itemsTotal: convertDatabaseAmountToMinorUnits(row.itemsTotal),
    discountTotal: convertDatabaseAmountToMinorUnits(row.discountTotal),
    shippingTotal: convertDatabaseAmountToMinorUnits(row.shippingTotal),
    total: convertDatabaseAmountToMinorUnits(row.total),
    shippingAddress: row.shippingAddress as unknown as ShippingAddressSnapshot,
    items: row.items.map((item) => ({
      ...item,
      unitPrice: convertDatabaseAmountToMinorUnits(item.unitPrice),
      lineTotal: convertDatabaseAmountToMinorUnits(item.lineTotal),
      attributionSource: item.attributionSource as SaleAttributionSource | null,
    })),
  };
}

const withItems = { items: true } as const;
const newestFirst = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export class PrismaOrdersRepository implements OrdersRepository {
  public async createCheckoutWithOrders(buyerId: string, chargeCurrency: CurrencyCode, orders: readonly NewOrder[]) {
    const total = orders.reduce((sum, order) => sum + order.chargeTotal, 0);
    return prisma().$transaction(async (tx) => {
      const checkout = await tx.checkout.create({ data: { buyerId, currency: chargeCurrency, total: BigInt(total) } });
      const created: OrderRecord[] = [];
      for (const order of orders) {
        const row = await tx.order.create({
          data: {
            ...order,
            checkoutId: checkout.id,
            itemsTotal: BigInt(order.itemsTotal),
            discountTotal: BigInt(order.discountTotal),
            shippingTotal: BigInt(order.shippingTotal),
            total: BigInt(order.total),
            chargeTotal: BigInt(order.chargeTotal),
            shippingAddress: { ...order.shippingAddress },
            items: { create: order.items.map((item) => ({ ...item, unitPrice: BigInt(item.unitPrice), lineTotal: BigInt(item.lineTotal) })) },
          },
          include: withItems,
        });
        created.push(convertOrderRowToRecord(row));
      }
      return { checkout: convertCheckoutRowToRecord(checkout), orders: created };
    });
  }

  public async findCheckoutById(checkoutId: string): Promise<CheckoutRecord | undefined> {
    const row = await prisma().checkout.findUnique({ where: { id: checkoutId } });
    return row === null ? undefined : convertCheckoutRowToRecord(row);
  }

  public async changeCheckoutStatus(checkoutId: string, from: CheckoutStatus, to: CheckoutStatus): Promise<boolean> {
    return (await prisma().checkout.updateMany({ where: { id: checkoutId, status: from }, data: { status: to } })).count === 1;
  }

  public async findById(orderId: string): Promise<OrderRecord | undefined> {
    const row = await prisma().order.findUnique({ where: { id: orderId }, include: withItems });
    return row === null ? undefined : convertOrderRowToRecord(row);
  }

  public async listByCheckout(checkoutId: string): Promise<readonly OrderRecord[]> {
    const rows = await prisma().order.findMany({ where: { checkoutId }, include: withItems });
    return rows.map(convertOrderRowToRecord);
  }

  public async listForBuyer(buyerId: string, statuses: readonly OrderStatus[] | undefined, page: PageRequest): Promise<Page<OrderRecord>> {
    return this.listPage({ buyerId, ...(statuses === undefined ? {} : { status: { in: [...statuses] } }) }, page);
  }

  public async listForStore(storeId: string, statuses: readonly OrderStatus[] | undefined, page: PageRequest, searchTerm?: string): Promise<Page<OrderRecord>> {
    return this.listPage(
      {
        storeId,
        ...(statuses === undefined ? {} : { status: { in: [...statuses] } }),
        ...(searchTerm === undefined
          ? {}
          : { OR: [{ number: { contains: searchTerm, mode: "insensitive" as const } }, { customerName: { contains: searchTerm, mode: "insensitive" as const } }] }),
      },
      page,
    );
  }

  public async listAllForBuyer(buyerId: string, statuses: readonly OrderStatus[]): Promise<readonly OrderRecord[]> {
    const rows = await prisma().order.findMany({ where: { buyerId, status: { in: [...statuses] } }, include: withItems, orderBy: newestFirst });
    return rows.map(convertOrderRowToRecord);
  }

  public async transitionStatus(orderId: string, from: readonly OrderStatus[], to: OrderStatus, change: OrderStatusChange): Promise<OrderRecord | undefined> {
    const result = await prisma().order.updateMany({ where: { id: orderId, status: { in: [...from] } }, data: { ...change, status: to } });
    return result.count === 1 ? this.findById(orderId) : undefined;
  }

  public async listStoreOrdersPaidSince(storeId: string, since: Date, statuses: readonly OrderStatus[]): Promise<readonly OrderRecord[]> {
    const rows = await prisma().order.findMany({ where: { storeId, paidAt: { gte: since }, status: { in: [...statuses] } }, include: withItems });
    return rows.map(convertOrderRowToRecord);
  }

  private async listPage(where: Prisma.OrderWhereInput, page: PageRequest): Promise<Page<OrderRecord>> {
    const rows = await prisma().order.findMany({ where, include: withItems, orderBy: newestFirst, ...buildPrismaPageArguments(page) });
    return mapPageItems(buildPageFromFetchedRows(rows, page), convertOrderRowToRecord);
  }
}
