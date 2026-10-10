import type { MockCoinRecord, MockWithdrawalRecord } from "@/mocks/handlers/money/moneyRecords.mock";
import type { WithdrawalStatus } from "@/types/withdrawals.type";

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

interface WithdrawalSeedRow {
  readonly user: string;
  readonly amountMinor: number;
  readonly feeMinor: number;
  readonly currency: string;
  readonly provider: string;
  readonly bank: readonly [string, string, string, string, number];
  readonly hoursAgo: number;
  readonly availableMinor: number;
  readonly status: WithdrawalStatus;
  readonly note?: string;
}

const withdrawalSeedRows: readonly WithdrawalSeedRow[] = [
  { user: "usr_0001", amountMinor: 1_250_000_00, feeMinor: 50_00, currency: "NGN", provider: "paystack", bank: ["GTBank", "4821", "ADAEZE NNAMDI OKONKWO", "NG", 9_000], hoursAgo: 3, availableMinor: 214_300_00, status: "pending_review" },
  { user: "usr_0012", amountMinor: 890_000_00, feeMinor: 50_00, currency: "NGN", provider: "paystack", bank: ["Opay", "0937", "ADEDAYO AKINOLA", "NG", 2], hoursAgo: 1.5, availableMinor: 0, status: "pending_review" },
  { user: "usr_0002", amountMinor: 340_500_00, feeMinor: 50_00, currency: "NGN", provider: "flutterwave", bank: ["Access Bank", "1170", "BABATUNDE OLALEKAN BAKARE", "NG", 4_000], hoursAgo: 7, availableMinor: 58_000_00, status: "pending_review" },
  { user: "usr_0007", amountMinor: 2_150_00, feeMinor: 15_00, currency: "GHS", provider: "flutterwave", bank: ["MTN MoMo", "4410", "KWAME MENSAH ASANTE", "GH", 3_000], hoursAgo: 12, availableMinor: 180_00, status: "pending_review" },
  { user: "usr_0005", amountMinor: 410_000_00, feeMinor: 50_00, currency: "NGN", provider: "paystack", bank: ["Zenith Bank", "6602", "CHUKWUEMEKA OBI", "NG", 30], hoursAgo: 26, availableMinor: 12_000_00, status: "on_hold", note: "Open dispute on a recent order; waiting for it to close." },
  { user: "usr_0008", amountMinor: 18_500_00, feeMinor: 110_00, currency: "KES", provider: "flutterwave", bank: ["M-Pesa", "7781", "WANJIRU KAMAU", "KE", 5_000], hoursAgo: 40, availableMinor: 2_200_00, status: "paid" },
  { user: "usr_0025", amountMinor: 780_000_00, feeMinor: 50_00, currency: "NGN", provider: "paystack", bank: ["Kuda", "2290", "OLUWAYEMI AFOLABI", "NG", 6_000], hoursAgo: 9, availableMinor: 95_000_00, status: "pending_review" },
  { user: "usr_0022", amountMinor: 420_00, feeMinor: 25, currency: "GBP", provider: "flutterwave", bank: ["Monzo", "3308", "OLUWATOMISIN AJAYI", "GB", 7_000], hoursAgo: 60, availableMinor: 31_00, status: "queued" },
  { user: "usr_0020", amountMinor: 150_000_00, feeMinor: 50_00, currency: "NGN", provider: "paystack", bank: ["Moniepoint", "0001", "DANGOTE GIVEAWAY", "NG", 20], hoursAgo: 300, availableMinor: 0, status: "failed", note: "Account banned for impersonation." },
];

export function buildDemoWithdrawals(): MockWithdrawalRecord[] {
  return withdrawalSeedRows.map((row, index) => {
    const [bankName, accountLast4, accountName, countryCode, addedHoursAgo] = row.bank;
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const isDecided = row.status !== "pending_review";
    return {
      id,
      reference: `WD-${String(240_100 + index)}`,
      userId: row.user,
      amountMinor: row.amountMinor,
      feeMinor: row.feeMinor,
      currency: row.currency,
      provider: row.provider,
      destination: { payoutAccountId: `pac_${index + 1}`, bankName, accountLast4, accountName, countryCode, addedAt: isoHoursAgo(addedHoursAgo), removed: false },
      createdAt: isoHoursAgo(row.hoursAgo),
      availableBalanceMinor: row.availableMinor,
      withdrawalStatus: row.status,
      failureReason: row.status === "failed" ? `rejected: ${row.note ?? ""}` : null,
      processedAt: row.status === "paid" || row.status === "failed" ? isoHoursAgo(row.hoursAgo - 2) : null,
      reviewedByStaffId: isDecided ? "adm_0002" : null,
      reviewedAt: isDecided ? isoHoursAgo(row.hoursAgo - 1) : null,
      reviewNote: row.note ?? null,
    };
  });
}

const coin = (record: Omit<MockCoinRecord, "reviewedAt" | "reviewedByStaffId" | "reviewNote" | "clawbackShortfallCoins"> & Partial<MockCoinRecord>): MockCoinRecord => ({ reviewedAt: null, reviewedByStaffId: null, reviewNote: null, clawbackShortfallCoins: 0, ...record });

export function buildDemoCoinTransactions(): MockCoinRecord[] {
  return [
    coin({ id: "c0000000-0000-4000-8000-000000000001", kind: "purchase", senderId: "usr_0018", receiverId: null, coins: 25_000, feeCoins: null, feeBasisPoints: null, fiatMinor: 250_000_00, currency: "NGN", reference: "CP-77120", paymentProvider: "paystack", channel: "web_checkout", reviewFlags: ["coin_purchase_velocity", "chargeback_history"], flags: [], createdAt: isoHoursAgo(2), transactionStatus: "succeeded", reviewStatus: "pending_review" }),
    coin({ id: "c0000000-0000-4000-8000-000000000002", kind: "transfer", senderId: "usr_0018", receiverId: "usr_0025", coins: 20_000, feeCoins: 6_000, feeBasisPoints: 3_000, fiatMinor: null, currency: "NGN", reference: null, paymentProvider: null, channel: null, reviewFlags: ["transfer_burst"], flags: ["chargeback_risk"], createdAt: isoHoursAgo(1.6), transactionStatus: "completed", reviewStatus: "pending_review" }),
    coin({ id: "c0000000-0000-4000-8000-000000000003", kind: "transfer", senderId: "usr_0016", receiverId: "usr_0011", coins: 4_000, feeCoins: 1_000, feeBasisPoints: 2_500, fiatMinor: null, currency: "NGN", reference: null, paymentProvider: null, channel: null, reviewFlags: [], flags: [], createdAt: isoHoursAgo(20), transactionStatus: "completed", reviewStatus: "not_required" }),
    coin({ id: "c0000000-0000-4000-8000-000000000004", kind: "purchase", senderId: "usr_0027", receiverId: null, coins: 1_200, feeCoins: null, feeBasisPoints: null, fiatMinor: 1_500_00, currency: "KES", reference: "CP-77001", paymentProvider: "apple", channel: "store_iap", reviewFlags: ["coin_purchase_velocity"], flags: [], createdAt: isoHoursAgo(30), transactionStatus: "succeeded", reviewStatus: "reviewed", reviewedAt: isoHoursAgo(28), reviewedByStaffId: "adm_0002", reviewNote: "Normal top-up pattern for this buyer." }),
    coin({ id: "c0000000-0000-4000-8000-000000000005", kind: "transfer", senderId: "usr_0020", receiverId: "usr_0012", coins: 90_000, feeCoins: 22_500, feeBasisPoints: 2_500, fiatMinor: null, currency: "NGN", reference: null, paymentProvider: null, channel: null, reviewFlags: ["transfer_fan_out", "open_wallet_risk_flag"], flags: ["impersonation"], createdAt: isoHoursAgo(290), transactionStatus: "reversed", reviewStatus: "reversed", reviewedAt: isoHoursAgo(280), reviewedByStaffId: "adm_0002", reviewNote: "Transfer ring of 212 linked accounts.", clawbackShortfallCoins: 12_000 }),
    coin({ id: "c0000000-0000-4000-8000-000000000006", kind: "transfer", senderId: "usr_0002", receiverId: "usr_0007", coins: 800, feeCoins: 240, feeBasisPoints: 3_000, fiatMinor: null, currency: "NGN", reference: null, paymentProvider: null, channel: null, reviewFlags: ["transfer_burst"], flags: [], createdAt: isoHoursAgo(5), transactionStatus: "completed", reviewStatus: "pending_review" }),
  ];
}
