import type { MockCoinRecord, MockPayoutRecord } from "@/mocks/handlers/money/moneyRecords.mock";
import type { FraudAssessment } from "@/types/payouts.type";

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function assessFraud(score: number, reasons: string[], hoursAgo: number): FraudAssessment {
  return { score, riskLevel: score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW", reasons, modelVersion: "payout-risk-2026.09.2", evaluatedAt: isoHoursAgo(hoursAgo) };
}

const bank = (institutionName: string, lastFour: string, accountName: string, addedHoursAgo: number) => ({ kind: "BANK_ACCOUNT" as const, institutionName, accountMasked: `••••${lastFour}`, accountName, addedAt: isoHoursAgo(addedHoursAgo) });
const mobileMoney = (institutionName: string, lastFour: string, accountName: string, addedHoursAgo: number) => ({ kind: "MOBILE_MONEY" as const, institutionName, accountMasked: `••• ••• ${lastFour}`, accountName, addedAt: isoHoursAgo(addedHoursAgo) });

export function buildDemoPayouts(): MockPayoutRecord[] {
  return [
    { id: "pyt_0001", userId: "usr_0001", amountMinor: 1_250_000_00, providerFeeMinor: 50_00, currency: "NGN", provider: "Paystack", destination: bank("GTBank", "4821", "ADAEZE NNAMDI OKONKWO", 9_000), source: "SELLER_SALES", requestedAt: isoHoursAgo(3), fraud: assessFraud(8, ["Destination used for 14 earlier payouts", "Amount within usual range"], 3), walletBalanceAfterMinor: 214_300_00, status: "PENDING" },
    { id: "pyt_0002", userId: "usr_0012", amountMinor: 890_000_00, providerFeeMinor: 50_00, currency: "NGN", provider: "Paystack", destination: bank("Opay", "0937", "ADEDAYO AKINOLA", 2), source: "SELLER_SALES", requestedAt: isoHoursAgo(1.5), fraud: assessFraud(91, ["New bank account added 2h ago", "Account name differs from verified legal name", "Seller is suspended with 3 strikes", "Velocity 5x the 30-day baseline"], 1.4), walletBalanceAfterMinor: 0, status: "PENDING" },
    { id: "pyt_0003", userId: "usr_0002", amountMinor: 340_500_00, providerFeeMinor: 50_00, currency: "NGN", provider: "Flutterwave", destination: bank("Access Bank", "1170", "BABATUNDE OLALEKAN BAKARE", 4_000), source: "CREATOR_EARNINGS", requestedAt: isoHoursAgo(7), fraud: assessFraud(22, ["Creator ad-share payout", "Device unchanged"], 7), walletBalanceAfterMinor: 58_000_00, status: "PENDING" },
    { id: "pyt_0004", userId: "usr_0007", amountMinor: 2_150_00, providerFeeMinor: 15_00, currency: "GHS", provider: "Flutterwave", destination: mobileMoney("MTN MoMo", "4410", "KWAME MENSAH ASANTE", 3_000), source: "CREATOR_EARNINGS", requestedAt: isoHoursAgo(12), fraud: assessFraud(35, ["Gifts from 3 accounts created this week"], 12), walletBalanceAfterMinor: 180_00, status: "PENDING" },
    { id: "pyt_0005", userId: "usr_0005", amountMinor: 410_000_00, providerFeeMinor: 50_00, currency: "NGN", provider: "Paystack", destination: bank("Zenith Bank", "6602", "CHUKWUEMEKA OBI", 30), source: "SELLER_SALES", requestedAt: isoHoursAgo(26), fraud: assessFraud(64, ["Device change since last login", "Open dispute on a recent order", "Bank account added 30h ago"], 26), walletBalanceAfterMinor: 12_000_00, status: "ON_HOLD" },
    { id: "pyt_0006", userId: "usr_0008", amountMinor: 18_500_00, providerFeeMinor: 110_00, currency: "KES", provider: "M-Pesa", destination: mobileMoney("M-Pesa", "7781", "WANJIRU KAMAU", 5_000), source: "SELLER_SALES", requestedAt: isoHoursAgo(40), fraud: assessFraud(12, ["Consistent weekly payout pattern"], 40), walletBalanceAfterMinor: 2_200_00, status: "PAID" },
    { id: "pyt_0007", userId: "usr_0025", amountMinor: 780_000_00, providerFeeMinor: 50_00, currency: "NGN", provider: "Paystack", destination: bank("Kuda", "2290", "OLUWAYEMI AFOLABI", 6_000), source: "CREATOR_EARNINGS", requestedAt: isoHoursAgo(9), fraud: assessFraud(46, ["Gift income 3x last month after a viral live", "Destination verified"], 9), walletBalanceAfterMinor: 95_000_00, status: "PENDING" },
    { id: "pyt_0008", userId: "usr_0022", amountMinor: 420_00, providerFeeMinor: 25, currency: "GBP", provider: "Flutterwave", destination: bank("Monzo", "3308", "OLUWATOMISIN AJAYI", 7_000), source: "CREATOR_EARNINGS", requestedAt: isoHoursAgo(60), fraud: assessFraud(5, ["Long-standing destination"], 60), walletBalanceAfterMinor: 31_00, status: "APPROVED" },
    { id: "pyt_0009", userId: "usr_0020", amountMinor: 150_000_00, providerFeeMinor: 50_00, currency: "NGN", provider: "Paystack", destination: bank("Moniepoint", "0001", "DANGOTE GIVEAWAY", 20), source: "WALLET", requestedAt: isoHoursAgo(300), fraud: assessFraud(98, ["Account banned for impersonation", "Coins received from 212 new accounts"], 300), walletBalanceAfterMinor: 0, status: "REJECTED" },
  ];
}

export function buildDemoCoinTransactions(): MockCoinRecord[] {
  return [
    { id: "coin_0001", kind: "PURCHASE", senderId: "usr_0018", receiverId: null, coins: 25_000, fiatMinor: 250_000_00, currency: "NGN", feeBasisPoints: null, context: "Coin pack: 25,000 coins", paymentProvider: "Paystack card •••• 1123", flags: ["First purchase over 10x usual size", "Card issued abroad"], chargebackRisk: "HIGH", createdAt: isoHoursAgo(2), status: "PENDING_REVIEW" },
    { id: "coin_0002", kind: "GIFT", senderId: "usr_0018", receiverId: "usr_0025", coins: 20_000, fiatMinor: 200_000_00, currency: "NGN", feeBasisPoints: 3_000, context: "Gift in live: “Friday night studio session”", paymentProvider: null, flags: ["Sender funded minutes before gifting", "Coins bought with high-risk card"], chargebackRisk: "HIGH", createdAt: isoHoursAgo(1.6), status: "PENDING_REVIEW" },
    { id: "coin_0003", kind: "TRANSFER", senderId: "usr_0016", receiverId: "usr_0011", coins: 4_000, fiatMinor: 40_000_00, currency: "NGN", feeBasisPoints: 2_500, context: "Direct coin transfer", paymentProvider: null, flags: [], chargebackRisk: "LOW", createdAt: isoHoursAgo(20), status: "REVIEWED" },
    { id: "coin_0004", kind: "PURCHASE", senderId: "usr_0027", receiverId: null, coins: 1_200, fiatMinor: 1_500_00, currency: "KES", feeBasisPoints: null, context: "Coin pack: 1,200 coins", paymentProvider: "M-Pesa", flags: [], chargebackRisk: "LOW", createdAt: isoHoursAgo(30), status: "REVIEWED" },
    { id: "coin_0005", kind: "TRANSFER", senderId: "usr_0020", receiverId: "usr_0012", coins: 90_000, fiatMinor: 900_000_00, currency: "NGN", feeBasisPoints: 2_500, context: "Direct coin transfer", paymentProvider: null, flags: ["Sender banned", "Receiver suspended", "Transfer ring: 212 linked accounts"], chargebackRisk: "HIGH", createdAt: isoHoursAgo(290), status: "REVERSED" },
    { id: "coin_0006", kind: "GIFT", senderId: "usr_0002", receiverId: "usr_0007", coins: 800, fiatMinor: 60_00, currency: "GHS", feeBasisPoints: 3_000, context: "Gift in live: “Afrobeats production Q&A”", paymentProvider: null, flags: ["Cross-border gift"], chargebackRisk: "MEDIUM", createdAt: isoHoursAgo(5), status: "PENDING_REVIEW" },
  ];
}
