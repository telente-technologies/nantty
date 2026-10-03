import { convertAccessToSellerPlan, type SellerPlan } from "@/config/planFeatures.config";
import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { buildDemoStoreTraffic, type DemoStoreTraffic } from "@/mocks/seed/demoTraffic.mock";
import type { Money } from "@/types/money.type";
import type { OnlineOrder } from "@/types/order.type";

export const ordersExcludedFromSales = new Set<OnlineOrder["status"]>(["cancelled", "refunded"]);

const dateKeyFormatterByTimezone = new Map<string, Intl.DateTimeFormat>();
const hourFormatterByTimezone = new Map<string, Intl.DateTimeFormat>();

function readCachedFormatter(cache: Map<string, Intl.DateTimeFormat>, timeZone: string, createFormatter: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  const cached = cache.get(timeZone);
  if (cached) return cached;
  const formatter = createFormatter();
  cache.set(timeZone, formatter);
  return formatter;
}

export function convertIsoToStoreDateKeyForAnalytics(isoDate: string, timeZone: string): string {
  return readCachedFormatter(dateKeyFormatterByTimezone, timeZone, () => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })).format(new Date(isoDate));
}

export function readHourAndWeekdayInStoreTimezone(isoDate: string, timeZone: string): { hour: number; weekday: number } {
  const parts = readCachedFormatter(hourFormatterByTimezone, timeZone, () => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23", weekday: "short" })).formatToParts(new Date(isoDate));
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24, weekday: Math.max(0, weekdayNames.indexOf(parts.find((part) => part.type === "weekday")?.value ?? "Sun")) };
}

export function shiftDateKeyByDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function countDaysBetweenDateKeysInclusive(fromKey: string, toKey: string): number {
  return Math.round((new Date(`${toKey}T12:00:00.000Z`).getTime() - new Date(`${fromKey}T12:00:00.000Z`).getTime()) / 86_400_000) + 1;
}

export function listDateKeysInclusive(fromKey: string, toKey: string): string[] {
  const dateKeys: string[] = [];
  for (let dateKey = fromKey; dateKey <= toKey && dateKeys.length < 800; dateKey = shiftDateKeyByDays(dateKey, 1)) dateKeys.push(dateKey);
  return dateKeys;
}

export function readTodayDateKeyForStore(): string {
  return convertIsoToStoreDateKeyForAnalytics(new Date().toISOString(), readMockDatabase().settings.timezone);
}

export function createStoreMoneyForAnalytics(amountMinor: number): Money {
  return { amountMinor, currency: readMockDatabase().settings.currency };
}

export function readSellerPlanForMockStore(storeId: string): SellerPlan {
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === storeId);
  return convertAccessToSellerPlan({ subscription: gateStore?.subscription.subscription ?? null });
}

export function listOrdersPlacedBetweenDateKeys(fromKey: string, toKey: string): OnlineOrder[] {
  const { onlineOrders, settings } = readMockDatabase();
  return onlineOrders.filter((order) => {
    const dateKey = convertIsoToStoreDateKeyForAnalytics(order.createdAt, settings.timezone);
    return dateKey >= fromKey && dateKey <= toKey;
  });
}

export function calculatePlatformFeeMinorForOrder(order: OnlineOrder): number {
  return Math.max(0, order.total.amountMinor - order.sellerPayout.amountMinor);
}

export function calculateBasisPointsRatio(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part * 10_000) / whole);
}

export function readStoreTrafficForAnalytics(): DemoStoreTraffic {
  return readStoreScopedMockSlice("analyticsTraffic", (storeId) => {
    const { products, onlineOrders } = readMockDatabase();
    const oldestOrderTime = Math.min(Date.now(), ...onlineOrders.map((order) => new Date(order.createdAt).getTime()));
    const historyDays = Math.max(30, (Date.now() - oldestOrderTime) / 86_400_000);
    return buildDemoStoreTraffic(storeId, products.map((product) => product.id), onlineOrders.length / historyDays);
  });
}

export function sumStoreTrafficBetweenDateKeys(fromKey: string, toKey: string): { storeViews: number; visitors: number } {
  const { dailyTrafficByDateKey } = readStoreTrafficForAnalytics();
  let storeViews = 0;
  let visitors = 0;
  for (const dateKey of listDateKeysInclusive(fromKey, toKey)) {
    const day = dailyTrafficByDateKey.get(dateKey);
    storeViews += day?.storeViews ?? 0;
    visitors += day?.visitors ?? 0;
  }
  return { storeViews, visitors };
}
