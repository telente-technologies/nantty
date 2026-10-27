import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { createSeededRandomNumberGenerator, pickRandomIntegerInclusive } from "@/mocks/seed/seededRandom.mock";
import type { Customer, CustomerPurchase, CustomersSummary } from "@/types/customer.type";
import type { OnlineOrder } from "@/types/order.type";

const excludedOrderStatuses = new Set(["cancelled", "refunded"]);
const millisecondsInOneDay = 86_400_000;

interface HistoricalPurchaseBaseline {
  readonly purchasesCount: number;
  readonly spentMinor: number;
  readonly firstPurchaseDaysAgo: number;
  readonly lastPurchaseDaysAgo: number;
}

function convertTextToSeedNumber(text: string): number {
  return [...text].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0, 2_166_136_261);
}

function buildUsernameFromCustomerName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".");
}

function buildHistoricalBaselineForCustomer(customerId: string, index: number): HistoricalPurchaseBaseline {
  const random = createSeededRandomNumberGenerator(convertTextToSeedNumber(customerId));
  if (index % 7 === 6) return { purchasesCount: 0, spentMinor: 0, firstPurchaseDaysAgo: 0, lastPurchaseDaysAgo: 0 };
  const purchasesCount = index % 4 === 1 ? 1 : pickRandomIntegerInclusive(1, 9, random);
  const firstPurchaseDaysAgo = index % 4 === 1 ? pickRandomIntegerInclusive(1, 25, random) : pickRandomIntegerInclusive(60, 420, random);
  const lastPurchaseDaysAgo = purchasesCount === 1 ? firstPurchaseDaysAgo : pickRandomIntegerInclusive(index % 5 === 0 ? 70 : 2, Math.max(3, Math.min(120, firstPurchaseDaysAgo - 1)), random);
  return { purchasesCount, spentMinor: purchasesCount * pickRandomIntegerInclusive(800_000, 4_500_000, random), firstPurchaseDaysAgo, lastPurchaseDaysAgo };
}

function readCustomerRosterState() {
  return readStoreScopedMockSlice("customerRoster", () => ({ hasMergedAppBuyers: false, baselines: new Map<string, HistoricalPurchaseBaseline>() }));
}

function mergeAppBuyersIntoCustomerRoster(): void {
  const rosterState = readCustomerRosterState();
  if (rosterState.hasMergedAppBuyers) return;
  const database = readMockDatabase();
  const knownUsernames = new Set(database.customers.map((customer) => customer.nanttyUsername).filter(Boolean));
  database.customers = database.customers.map((customer) => (customer.nanttyUsername ? customer : { ...customer, nanttyUsername: buildUsernameFromCustomerName(customer.name) }));
  for (const order of [...database.onlineOrders].reverse()) {
    if (knownUsernames.has(order.buyer.username)) continue;
    knownUsernames.add(order.buyer.username);
    database.customers.push({
      id: `cus_app_${order.buyer.id}`,
      name: order.buyer.name,
      phone: order.shippingAddress.phone,
      email: null,
      nanttyUsername: order.buyer.username,
      city: order.shippingAddress.city,
      tags: [],
      notes: [],
      storeCreditBalance: { amountMinor: 0, currency: database.settings.currency },
      storeCreditExpiresAt: null,
      totalSpent: { amountMinor: 0, currency: database.settings.currency },
      averageOrderValue: null,
      purchasesCount: 0,
      firstPurchaseAt: null,
      lastPurchaseAt: null,
      createdAt: order.createdAt,
      marketingOptIn: true,
    });
  }
  database.customers.forEach((customer, index) => rosterState.baselines.set(customer.id, customer.id.startsWith("cus_app_") ? { purchasesCount: 0, spentMinor: 0, firstPurchaseDaysAgo: 0, lastPurchaseDaysAgo: 0 } : buildHistoricalBaselineForCustomer(customer.id, index)));
  rosterState.hasMergedAppBuyers = true;
}

export function listCountableOrdersForCustomer(customer: Pick<Customer, "nanttyUsername">): OnlineOrder[] {
  if (!customer.nanttyUsername) return [];
  return readMockDatabase().onlineOrders.filter((order) => order.buyer.username === customer.nanttyUsername && !excludedOrderStatuses.has(order.status));
}

export function addPurchaseStatsToCustomer(customer: Customer): Customer {
  const baseline = readCustomerRosterState().baselines.get(customer.id);
  const orders = listCountableOrdersForCustomer(customer);
  const orderTimes = orders.map((order) => new Date(order.createdAt).getTime());
  const baselineFirst = baseline && baseline.purchasesCount > 0 ? Date.now() - baseline.firstPurchaseDaysAgo * millisecondsInOneDay : null;
  const baselineLast = baseline && baseline.purchasesCount > 0 ? Date.now() - baseline.lastPurchaseDaysAgo * millisecondsInOneDay : null;
  const purchaseTimes = [...orderTimes, ...(baselineFirst ? [baselineFirst] : []), ...(baselineLast ? [baselineLast] : [])];
  const purchasesCount = orders.length + (baseline?.purchasesCount ?? 0);
  const spentMinor = orders.reduce((sum, order) => sum + order.total.amountMinor, 0) + (baseline?.spentMinor ?? 0);
  const currency = customer.totalSpent.currency;
  const rewards = readMockDatabase().settings.storeRewards;
  const creditMinor = rewards.enabled && purchasesCount > 0 ? Math.min(Math.round((spentMinor * rewards.percentBackBasisPoints) / 10_000), rewards.maxPerOrder.amountMinor * purchasesCount) : 0;
  const lastPurchaseMs = purchaseTimes.length > 0 ? Math.max(...purchaseTimes) : null;
  return {
    ...customer,
    storeCreditBalance: { amountMinor: creditMinor, currency },
    storeCreditExpiresAt: creditMinor > 0 && lastPurchaseMs ? new Date(lastPurchaseMs + rewards.expiryDays * millisecondsInOneDay).toISOString() : null,
    city: customer.city ?? orders[0]?.shippingAddress.city ?? null,
    totalSpent: { amountMinor: spentMinor, currency },
    averageOrderValue: purchasesCount > 0 ? { amountMinor: Math.round(spentMinor / purchasesCount), currency } : null,
    purchasesCount,
    firstPurchaseAt: purchaseTimes.length > 0 ? new Date(Math.min(...purchaseTimes)).toISOString() : null,
    lastPurchaseAt: purchaseTimes.length > 0 ? new Date(Math.max(...purchaseTimes)).toISOString() : null,
  };
}

export function listCustomersWithPurchaseStats(): Customer[] {
  mergeAppBuyersIntoCustomerRoster();
  return readMockDatabase().customers.map(addPurchaseStatsToCustomer);
}

export function listCustomerPurchasesFromAppOrders(customer: Customer): CustomerPurchase[] {
  if (!customer.nanttyUsername) return [];
  return readMockDatabase()
    .onlineOrders.filter((order) => order.buyer.username === customer.nanttyUsername)
    .map((order) => ({ kind: "online_order" as const, id: order.id, reference: order.orderNumber, status: order.status, total: order.total, itemsCount: order.lines.reduce((sum, line) => sum + line.quantity, 0), createdAt: order.createdAt }))
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

function buildMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildCustomersSummary(): CustomersSummary {
  const customers = listCustomersWithPurchaseStats();
  const currency = readMockDatabase().settings.currency;
  const buyers = customers.filter((customer) => customer.purchasesCount > 0);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const totalRevenueMinor = buyers.reduce((sum, customer) => sum + customer.totalSpent.amountMinor, 0);
  const totalPurchases = buyers.reduce((sum, customer) => sum + customer.purchasesCount, 0);
  const returningCustomers = buyers.filter((customer) => customer.purchasesCount >= 2).length;
  const growth = Array.from({ length: 6 }, (_, offset) => {
    const monthDate = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - (5 - offset), 1));
    const monthKey = buildMonthKey(monthDate);
    const firstInMonth = buyers.filter((customer) => customer.firstPurchaseAt && buildMonthKey(new Date(customer.firstPurchaseAt)) === monthKey).length;
    const returningInMonth = buyers.filter((customer) => customer.purchasesCount >= 2 && customer.lastPurchaseAt && buildMonthKey(new Date(customer.lastPurchaseAt)) === monthKey && buildMonthKey(new Date(customer.firstPurchaseAt ?? customer.lastPurchaseAt)) !== monthKey).length;
    return { month: monthKey, newCustomers: firstInMonth, returningCustomers: returningInMonth };
  });
  return {
    totalCustomers: customers.length,
    newThisMonth: buyers.filter((customer) => customer.firstPurchaseAt && new Date(customer.firstPurchaseAt) >= monthStart).length,
    returningCustomers,
    repeatRateBasisPoints: buyers.length > 0 ? Math.round((returningCustomers * 10_000) / buyers.length) : 0,
    averageOrderValue: { amountMinor: totalPurchases > 0 ? Math.round(totalRevenueMinor / totalPurchases) : 0, currency },
    totalRevenue: { amountMinor: totalRevenueMinor, currency },
    growth,
  };
}
