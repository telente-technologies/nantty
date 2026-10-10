import { c } from "./contractSchema.util";
import type { EndpointContract } from "./endpointContract.type";

const userSummary = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()) });
const user = c.object({ id: c.string(), name: c.string(), username: c.string(), avatarUrl: c.nullable(c.string()), bio: c.string() });
const reason = c.string(["taken", "reserved", "invalid", "recently_used", "withheld"]);
const money = c.object({ amountMinor: c.number(), currency: c.string() });
const walletLine = c.object({ key: c.string(), label: c.string(), description: c.string(), amount: money });
const walletSummary = c.object({
  available: money,
  pending: money,
  locked: money,
  inEscrow: money,
  payoutRequested: money,
  negativeBalance: money,
  nextAvailableAt: c.nullable(c.string()),
  adCredit: money,
  earningsPayable: money,
  debts: money,
  coins: c.object({ spendable: c.number(), earned: c.number() }),
  lines: c.array(walletLine),
  verification: c.object({ level: c.number(), withdrawalsUnlocked: c.boolean(), waitingForVerification: money, nextStep: c.nullable(c.string(["payout_setup", "bank_validation", "identity_check", "business_verification"])), message: c.nullable(c.string()) }),
});
const freeBoost = c.object({ premium: c.boolean(), eligible: c.boolean(), remainingThisMonth: c.number(), maxTotal: money, resetsAt: c.nullable(c.string()) });
const boostOptions = c.object({ minimumDailyBudget: money, suggestedDailyBudgets: c.array(money), durationDayOptions: c.array(c.number()), interests: c.array(c.string()), paymentMethods: c.array(c.string(["card", "balance", "free"])), freeBoost });

export const webappContracts: readonly EndpointContract[] = [
  { domain: "auth", method: "POST", path: "/api/v1/auth/login", body: { identifier: "zudomart@test.com", password: "x" }, schema: c.object({ accessToken: c.string(), refreshToken: c.string(), user }) },
  { domain: "auth", method: "GET", path: "/api/v1/auth/username-available?username=admin", schema: c.object({ available: c.boolean(), reason }, []) },
  { domain: "users", method: "GET", path: "/api/v1/users/me", schema: user },
  { domain: "users", method: "GET", path: "/api/v1/users/me/addresses", schema: c.page(c.object({ id: c.string(), line1: c.string(), city: c.string(), state: c.string(), isDefault: c.boolean() })) },
  { domain: "users", method: "GET", path: "/api/v1/locale/countries", schema: c.page(c.object({ countryCode: c.string(), countryName: c.string(), currency: c.string() })) },
  { domain: "users", method: "GET", path: "/api/v1/users/me/username-policy", schema: c.object({ username: c.string(), canChangeNow: c.boolean(), cooldownDays: c.number(), maxChangesPerYear: c.number(), quarantineDays: c.number(), history: c.array(c.any()) }) },
  {
    domain: "chatKeys",
    method: "POST",
    path: "/api/v1/chat/keys/devices/query",
    body: { userIds: ["u_21"] },
    schema: c.object({ data: c.array(c.object({ userId: c.string(), devices: c.array(c.object({ deviceId: c.string(), registrationId: c.number(), identityKey: c.string() })) })) }),
  },
  {
    domain: "chatKeys",
    method: "POST",
    path: "/api/v1/chat/keys/bundles",
    body: { devices: [{ userId: "u_21", deviceId: "unknown-device" }] },
    schema: c.object({ data: c.array(c.any()) }),
  },
  { domain: "wallets", method: "GET", path: "/api/v1/wallets/me", schema: walletSummary },
  { domain: "ads", method: "GET", path: "/api/v1/ads/boosts/options", schema: boostOptions },
  { domain: "live", method: "GET", path: "/api/v1/lives/suggested", schema: c.page(c.object({ id: c.string(), host: userSummary, title: c.string(), coverUrl: c.nullable(c.string()) })) },
];
