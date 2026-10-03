import type { MockAdAccountRecord, MockInviteRecord, MockMemberRecord } from "@/mocks/mockDatabase.mock";
import { shiftTimestampByDays } from "@/mocks/seed/seededRandom.mock";

export function buildDemoAccountRecords(): MockAdAccountRecord[] {
  return [
    {
      id: "act_ifelifestyle",
      name: "Ife Lifestyle",
      kind: "business",
      currency: "NGN",
      timezone: "Africa/Lagos",
      countryCode: "NG",
      status: "active",
      business: { storeId: "st_ifelifestyle", storeName: "Ife Lifestyle", handle: "ifelifestyle", logoUrl: null, goldVerified: true, countryCode: "NG" },
      ownerUserId: "usr_adaeze",
      createdAt: shiftTimestampByDays(-210),
      balanceMinor: 38_450_000,
      creditsMinor: 1_500_000,
      monthlyCreditMinor: 2_500_000,
      spendLimitMinor: 250_000_000,
      fundingMode: "prepaid_and_card",
      paymentMethods: [{ id: "pm_ife_visa", brand: "Visa", last4: "4081", expMonth: 8, expYear: 2028, isDefault: true, provider: "paystack" }],
    },
    {
      id: "act_adaeze",
      name: "Adaeze Okafor",
      kind: "personal",
      currency: "NGN",
      timezone: "Africa/Lagos",
      countryCode: "NG",
      status: "active",
      business: null,
      ownerUserId: "usr_adaeze",
      createdAt: shiftTimestampByDays(-120),
      balanceMinor: 1_250_000,
      creditsMinor: 0,
      monthlyCreditMinor: null,
      spendLimitMinor: null,
      fundingMode: "prepaid",
      paymentMethods: [],
    },
    {
      id: "act_kelechikicks",
      name: "Kelechi Kicks",
      kind: "business",
      currency: "NGN",
      timezone: "Africa/Lagos",
      countryCode: "NG",
      status: "active",
      business: { storeId: "st_kelechikicks", storeName: "Kelechi Kicks", handle: "kelechi.kicks", logoUrl: null, goldVerified: false, countryCode: "NG" },
      ownerUserId: "usr_kelechi",
      createdAt: shiftTimestampByDays(-95),
      balanceMinor: 6_020_000,
      creditsMinor: 0,
      monthlyCreditMinor: null,
      spendLimitMinor: 60_000_000,
      fundingMode: "prepaid",
      paymentMethods: [],
    },
    {
      id: "act_kenteheritage",
      name: "Kente Heritage Accra",
      kind: "business",
      currency: "GHS",
      timezone: "Africa/Accra",
      countryCode: "GH",
      status: "active",
      business: { storeId: "st_kenteheritage", storeName: "Kente Heritage", handle: "kente.heritage", logoUrl: null, goldVerified: true, countryCode: "GH" },
      ownerUserId: "usr_ama",
      createdAt: shiftTimestampByDays(-70),
      balanceMinor: 184_000,
      creditsMinor: 30_000,
      monthlyCreditMinor: 50_000,
      spendLimitMinor: null,
      fundingMode: "card",
      paymentMethods: [{ id: "pm_kente_mc", brand: "Mastercard", last4: "5512", expMonth: 3, expYear: 2027, isDefault: true, provider: "paystack" }],
    },
  ];
}

export function buildDemoMemberRecords(): MockMemberRecord[] {
  return [
    { accountId: "act_ifelifestyle", userId: "usr_adaeze", role: "admin", addedAt: shiftTimestampByDays(-210), lastActiveAt: shiftTimestampByDays(0, 8) },
    { accountId: "act_ifelifestyle", userId: "usr_tunde", role: "advertiser", addedAt: shiftTimestampByDays(-180), lastActiveAt: shiftTimestampByDays(-1, 16) },
    { accountId: "act_ifelifestyle", userId: "usr_blessing", role: "analyst", addedAt: shiftTimestampByDays(-90), lastActiveAt: shiftTimestampByDays(-3, 11) },
    { accountId: "act_ifelifestyle", userId: "usr_ibrahim", role: "billing", addedAt: shiftTimestampByDays(-60), lastActiveAt: shiftTimestampByDays(-6, 10) },
    { accountId: "act_adaeze", userId: "usr_adaeze", role: "admin", addedAt: shiftTimestampByDays(-120), lastActiveAt: shiftTimestampByDays(-2, 20) },
    { accountId: "act_kelechikicks", userId: "usr_kelechi", role: "admin", addedAt: shiftTimestampByDays(-95), lastActiveAt: shiftTimestampByDays(0, 7) },
    { accountId: "act_kelechikicks", userId: "usr_adaeze", role: "analyst", addedAt: shiftTimestampByDays(-40), lastActiveAt: shiftTimestampByDays(-9, 13) },
    { accountId: "act_kenteheritage", userId: "usr_ama", role: "admin", addedAt: shiftTimestampByDays(-70), lastActiveAt: shiftTimestampByDays(-1, 9) },
    { accountId: "act_kenteheritage", userId: "usr_adaeze", role: "billing", addedAt: shiftTimestampByDays(-30), lastActiveAt: null },
  ];
}

export function buildDemoInviteRecords(): MockInviteRecord[] {
  return [
    { id: "inv_chioma", accountId: "act_ifelifestyle", token: "demo-invite-chioma", email: "chioma@ifelifestyle.ng", role: "advertiser", invitedBy: "Adaeze Okafor", status: "pending", createdAt: shiftTimestampByDays(-2), expiresAt: shiftTimestampByDays(5) },
    { id: "inv_kelechi_team", accountId: "act_kelechikicks", token: "demo-invite-kelechi", email: "adaeze@ifelifestyle.ng", role: "advertiser", invitedBy: "Kelechi Obi", status: "pending", createdAt: shiftTimestampByDays(-1), expiresAt: shiftTimestampByDays(6) },
  ];
}
