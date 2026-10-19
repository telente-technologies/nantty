import type { AdCreditSource, AdCreditStatus } from "@/types/adCredit.type";

export interface MockAdCreditRecord {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly source: AdCreditSource;
  readonly amountMinor: number;
  remainingMinor: number;
  readonly currency: string;
  readonly expiresAt: string | null;
  readonly reason: string;
  status: AdCreditStatus;
  readonly issuedBy: { readonly id: string; readonly name: string } | null;
  readonly createdAt: string;
  revokedAt: string | null;
  revokedMinor: number | null;
}

export interface MockAdCashbackRecord {
  readonly userId: string;
  enabled: boolean;
  percent: number;
  reason: string;
  updatedAt: string;
  updatedBy: { readonly id: string; readonly name: string } | null;
}

const dayInMs = 86_400_000;

export function buildDemoAdCredits(nowEpochMs: number = Date.now()): MockAdCreditRecord[] {
  const at = (days: number) => new Date(nowEpochMs + days * dayInMs).toISOString();
  return [
    { id: "adc_0001", userId: "usr_0001", accountId: "ada_0001", source: "admin_issued", amountMinor: 2_000_000, remainingMinor: 1_250_000, currency: "NGN", expiresAt: at(20), reason: "Launch promotion for early sellers", status: "active", issuedBy: { id: "adm_demo", name: "Demo Admin" }, createdAt: at(-10), revokedAt: null, revokedMinor: null },
    { id: "adc_0002", userId: "usr_0002", accountId: "ada_0002", source: "cashback", amountMinor: 45_000, remainingMinor: 45_000, currency: "NGN", expiresAt: null, reason: "10% cashback on settled ad spend", status: "active", issuedBy: null, createdAt: at(-2), revokedAt: null, revokedMinor: null },
    { id: "adc_0003", userId: "usr_0003", accountId: "ada_0003", source: "admin_issued", amountMinor: 500_000, remainingMinor: 0, currency: "NGN", expiresAt: at(-1), reason: "Apology for a delayed ad review", status: "expired", issuedBy: { id: "adm_demo", name: "Demo Admin" }, createdAt: at(-40), revokedAt: null, revokedMinor: null },
    { id: "adc_0004", userId: "usr_0001", accountId: "ada_0001", source: "admin_issued", amountMinor: 1_000_000, remainingMinor: 0, currency: "NGN", expiresAt: null, reason: "Creator programme welcome credit", status: "spent", issuedBy: { id: "adm_demo", name: "Demo Admin" }, createdAt: at(-60), revokedAt: null, revokedMinor: null },
  ];
}

export function buildDemoAdCashbackSettings(nowEpochMs: number = Date.now()): MockAdCashbackRecord[] {
  return [{ userId: "usr_0002", enabled: true, percent: 10, reason: "Agency partner pilot", updatedAt: new Date(nowEpochMs - 5 * dayInMs).toISOString(), updatedBy: { id: "adm_demo", name: "Demo Admin" } }];
}
