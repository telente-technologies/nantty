import { StoreRole } from "../../../constants/roles.constant.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { notFound } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { InventoryLine, ProductCatalog } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { Money, type MoneyDto } from "../../../utils/money.util.js";
import { resolveSellerStoreIdForUser } from "../../../utils/sellerStore.util.js";
import { SALE_STATUSES, type OrderRecord } from "../models/orders.model.js";
import type { OrdersRepository } from "../repositories/orders.repository.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LAGOS_OFFSET = HOUR;
const RECENT_ORDER_COUNT = 5;

export const DASHBOARD_PERIODS = ["live", "yesterday", "today", "week", "month", "all"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export interface ChartPoint {
  readonly label: string;
  readonly amount: MoneyDto;
}

export interface StoreDashboard {
  readonly storeId: string;
  readonly currency: CurrencyCode;
  readonly period: DashboardPeriod;
  readonly totalSales: MoneyDto;
  readonly orderCount: number;
  readonly sales: Readonly<Record<Exclude<DashboardPeriod, "all">, MoneyDto>>;
  readonly chart: readonly ChartPoint[];
  readonly recentOrders: readonly OrderRecord[];
  readonly inventory: readonly InventoryLine[];
}

interface PeriodWindow {
  readonly from: number;
  readonly to: number;
}

export function calculateLagosPeriodWindows(now: Date): Readonly<Record<DashboardPeriod, PeriodWindow>> {
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET);
  const todayStart = Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate()) - LAGOS_OFFSET;
  const daysSinceMonday = (lagosNow.getUTCDay() + 6) % 7;
  const end = now.getTime() + 1;
  return {
    live: { from: now.getTime() - HOUR, to: end },
    today: { from: todayStart, to: end },
    yesterday: { from: todayStart - DAY, to: todayStart },
    week: { from: todayStart - daysSinceMonday * DAY, to: end },
    month: { from: Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), 1) - LAGOS_OFFSET, to: end },
    all: { from: 0, to: end },
  };
}

function selectOrdersPaidWithin(orders: readonly OrderRecord[], window: PeriodWindow): readonly OrderRecord[] {
  return orders.filter((order) => order.paidAt !== null && order.paidAt.getTime() >= window.from && order.paidAt.getTime() < window.to);
}

function sumOrderTotals(orders: readonly OrderRecord[], currency: CurrencyCode): MoneyDto {
  return Money.sum(orders.map((order) => Money.of(order.total, order.currency)), currency).toDto();
}

function buildChartBuckets(period: DashboardPeriod, window: PeriodWindow, now: Date): readonly (PeriodWindow & { readonly label: string })[] {
  if (period === "live") {
    return Array.from({ length: 12 }, (_, index) => ({ label: `${index * 5}m`, from: window.from + index * 300_000, to: window.from + (index + 1) * 300_000 }));
  }
  if (period === "today" || period === "yesterday") {
    return Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2, "0")}:00`, from: window.from + hour * HOUR, to: window.from + (hour + 1) * HOUR }));
  }
  if (period === "week" || period === "month") {
    const days = Math.max(1, Math.ceil((now.getTime() - window.from) / DAY));
    return Array.from({ length: days }, (_, day) => ({
      label: new Date(window.from + day * DAY + LAGOS_OFFSET).toISOString().slice(0, 10),
      from: window.from + day * DAY,
      to: window.from + (day + 1) * DAY,
    }));
  }
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET);
  return Array.from({ length: 12 }, (_, index) => {
    const monthStart = Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth() - 11 + index, 1) - LAGOS_OFFSET;
    const nextMonthStart = Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth() - 10 + index, 1) - LAGOS_OFFSET;
    return { label: new Date(monthStart + LAGOS_OFFSET).toISOString().slice(0, 7), from: monthStart, to: nextMonthStart };
  });
}

export class StoreDashboardService {
  public constructor(
    private readonly orders: OrdersRepository,
    private readonly storeAccess: StoreAccess,
    private readonly productCatalog: ProductCatalog,
    private readonly clock: Clock,
  ) {}

  public async buildStoreDashboard(userId: string, requestedStoreId: string | undefined, period: DashboardPeriod): Promise<StoreDashboard> {
    const storeId = await resolveSellerStoreIdForUser(this.storeAccess, userId, requestedStoreId, [StoreRole.OWNER, StoreRole.MANAGER]);
    const [store] = await this.storeAccess.findStoreSummaries([storeId]);
    if (store === undefined) throw notFound("Store");
    const now = this.clock.now();
    const windows = calculateLagosPeriodWindows(now);
    const earliest = period === "all" ? 0 : Math.min(windows.yesterday.from, windows.week.from, windows.month.from);
    const paidOrders = await this.orders.listStoreOrdersPaidSince(storeId, new Date(earliest), SALE_STATUSES);
    const ordersInPeriod = selectOrdersPaidWithin(paidOrders, windows[period]);
    const salesFor = (name: Exclude<DashboardPeriod, "all">) => sumOrderTotals(selectOrdersPaidWithin(paidOrders, windows[name]), store.currency);
    const recent = await this.orders.listForStore(storeId, undefined, { limit: RECENT_ORDER_COUNT });
    return {
      storeId,
      currency: store.currency,
      period,
      totalSales: sumOrderTotals(ordersInPeriod, store.currency),
      orderCount: ordersInPeriod.length,
      sales: { live: salesFor("live"), today: salesFor("today"), yesterday: salesFor("yesterday"), week: salesFor("week"), month: salesFor("month") },
      chart: buildChartBuckets(period, windows[period], now).map((bucket) => ({
        label: bucket.label,
        amount: sumOrderTotals(selectOrdersPaidWithin(ordersInPeriod, bucket), store.currency),
      })),
      recentOrders: recent.data,
      inventory: await this.productCatalog.listInventoryForStore(storeId),
    };
  }
}
