import { StoreRole } from "../../../constants/roles.constant.js";
import type { InventoryLine, ProductCatalog } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { MinorUnits } from "../../../types/money.type.js";
import { SALE_STATUSES, type OrderRecord } from "../models/orders.model.js";
import type { OrdersRepository } from "../repositories/orders.repository.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LAGOS_OFFSET = HOUR;
const RECENT_ORDER_COUNT = 5;

export interface StoreDashboard {
  readonly currency: string;
  readonly sales: { readonly live: MinorUnits; readonly today: MinorUnits; readonly yesterday: MinorUnits; readonly thisWeek: MinorUnits; readonly thisMonth: MinorUnits };
  readonly orderCount: number;
  readonly orderCounts: { readonly today: number; readonly thisWeek: number; readonly thisMonth: number };
  readonly hourlySales: readonly { readonly hour: number; readonly amount: MinorUnits }[];
  readonly recentOrders: readonly OrderRecord[];
  readonly inventory: readonly InventoryLine[];
}

export function calculateLagosPeriodStarts(now: Date) {
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET);
  const todayStart = Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate()) - LAGOS_OFFSET;
  const daysSinceMonday = (lagosNow.getUTCDay() + 6) % 7;
  return {
    live: now.getTime() - HOUR,
    today: todayStart,
    yesterday: todayStart - DAY,
    week: todayStart - daysSinceMonday * DAY,
    month: Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), 1) - LAGOS_OFFSET,
  };
}

function sumOrderTotalsPaidBetween(orders: readonly OrderRecord[], from: number, to: number): MinorUnits {
  return orders
    .filter((order) => order.paidAt !== null && order.paidAt.getTime() >= from && order.paidAt.getTime() < to)
    .reduce((total, order) => total + order.total, 0);
}

export class StoreDashboardService {
  public constructor(
    private readonly orders: OrdersRepository,
    private readonly storeAccess: StoreAccess,
    private readonly productCatalog: ProductCatalog,
    private readonly clock: Clock,
    private readonly currency: string,
  ) {}

  public async buildStoreDashboard(userId: string, storeId: string): Promise<StoreDashboard> {
    await this.storeAccess.assertStoreMember(userId, storeId, [StoreRole.OWNER, StoreRole.MANAGER]);
    const now = this.clock.now();
    const end = now.getTime() + 1;
    const starts = calculateLagosPeriodStarts(now);
    const earliest = Math.min(starts.yesterday, starts.week, starts.month);
    const orders = await this.orders.listStoreOrdersPaidSince(storeId, new Date(earliest), SALE_STATUSES);
    const countPaidSince = (from: number) => orders.filter((order) => order.paidAt !== null && order.paidAt.getTime() >= from).length;
    const hourlySales = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      amount: sumOrderTotalsPaidBetween(orders, starts.today + hour * HOUR, starts.today + (hour + 1) * HOUR),
    }));
    const recent = await this.orders.listForStore(storeId, undefined, { limit: RECENT_ORDER_COUNT });
    return {
      currency: this.currency,
      sales: {
        live: sumOrderTotalsPaidBetween(orders, starts.live, end),
        today: sumOrderTotalsPaidBetween(orders, starts.today, end),
        yesterday: sumOrderTotalsPaidBetween(orders, starts.yesterday, starts.today),
        thisWeek: sumOrderTotalsPaidBetween(orders, starts.week, end),
        thisMonth: sumOrderTotalsPaidBetween(orders, starts.month, end),
      },
      orderCount: countPaidSince(starts.month),
      orderCounts: { today: countPaidSince(starts.today), thisWeek: countPaidSince(starts.week), thisMonth: countPaidSince(starts.month) },
      hourlySales,
      recentOrders: recent.items,
      inventory: await this.productCatalog.listInventoryForStore(storeId),
    };
  }
}
