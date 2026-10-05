import { supportedAccountCountries } from "@/constants/locale.constant";
import { presentAccountDetail, presentAccountSummary, requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { appendMockActivity, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { failValidation, paginateItems, readJsonObjectBody, readRequiredTrimmedString, requirePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { LinkedBusinessProfile } from "@/types/adAccount.type";

const linkableBusinessProfilesByUserId: Record<string, LinkedBusinessProfile[]> = {
  usr_adaeze: [
    { storeId: "st_ifelifestyle", storeName: "Ife Lifestyle", handle: "ifelifestyle", logoUrl: null, goldVerified: true, countryCode: "NG" },
    { storeId: "st_ifehome", storeName: "Ife Home & Candles", handle: "ifehome", logoUrl: null, goldVerified: false, countryCode: "NG" },
  ],
  usr_kelechi: [{ storeId: "st_kelechikicks", storeName: "Kelechi Kicks", handle: "kelechi.kicks", logoUrl: null, goldVerified: false, countryCode: "NG" }],
  usr_ama: [{ storeId: "st_kenteheritage", storeName: "Kente Heritage", handle: "kente.heritage", logoUrl: null, goldVerified: true, countryCode: "GH" }],
};

export function registerAccountMockHandlers(): void {
  registerMockRoute("GET", "/ads/memberships", (request) => {
    const principal = requirePrincipal(request);
    const items = readMockDatabase().members.filter((member) => member.userId === principal.userId).map((member) => ({ accountId: member.accountId, role: member.role }));
    return respondWithJson(200, { data: items, nextCursor: null });
  });

  registerMockRoute("GET", "/ads/accounts", (request) => {
    const principal = requirePrincipal(request);
    const database = readMockDatabase();
    const items = database.members
      .filter((member) => member.userId === principal.userId)
      .flatMap((member) => {
        const account = database.accounts.find((candidate) => candidate.id === member.accountId);
        return account ? [presentAccountSummary(account, member.role)] : [];
      });
    return respondWithJson(200, { items });
  });

  registerMockRoute("GET", "/ads/business-profiles", (request) => respondWithJson(200, { items: linkableBusinessProfilesByUserId[requirePrincipal(request).userId] ?? [] }));

  registerMockRoute("POST", "/ads/accounts", (request) => {
    const principal = requirePrincipal(request);
    const body = readJsonObjectBody(request);
    const database = readMockDatabase();
    const name = readRequiredTrimmedString(body, "name", 80);
    const kind = body.kind === "business" ? "business" : body.kind === "personal" ? "personal" : failValidation("kind", "Choose personal or business.");
    const countryCode = String(body.countryCode ?? "");
    const country = supportedAccountCountries.find((candidate) => candidate.code === countryCode) ?? failValidation("countryCode", "Choose a supported country.");
    let business: LinkedBusinessProfile | null = null;
    if (kind === "business") {
      business = (linkableBusinessProfilesByUserId[principal.userId] ?? []).find((profile) => profile.storeId === body.storeId) ?? failValidation("storeId", "Choose one of your stores or business profiles.");
      if (database.accounts.some((account) => account.business?.storeId === business?.storeId)) failValidation("storeId", "This store already has an ad account.");
    }
    if (database.members.filter((member) => member.userId === principal.userId && member.role === "admin").length >= 10) failValidation("name", "You can administer at most 10 ad accounts.");
    const accountId = `act_${name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16)}${Date.now().toString(36).slice(-4)}`;
    const now = new Date().toISOString();
    const currency = country.currency;
    database.accounts.push({
      id: accountId,
      name,
      kind,
      currency,
      timezone: typeof body.timezone === "string" && body.timezone.length < 60 ? body.timezone : country.timezone,
      countryCode: country.code,
      status: "active",
      business,
      ownerUserId: principal.userId,
      createdAt: now,
      balanceMinor: 0,
      creditsMinor: 0,
      monthlyCreditMinor: business?.goldVerified ? (currency === "NGN" ? 2_500_000 : 50_000) : null,
      spendLimitMinor: null,
      fundingMode: "prepaid",
      paymentMethods: [],
    });
    database.members.push({ accountId, userId: principal.userId, role: "admin", addedAt: now, lastActiveAt: now });
    appendMockActivity(accountId, { actor: { id: principal.userId, name: principal.actorName, isSystem: false }, action: "account_created", objectType: "account", objectId: accountId, objectName: name, summary: "Created the ad account", changes: [] });
    const created = database.accounts.find((account) => account.id === accountId);
    return respondWithJson(201, created ? presentAccountDetail(created, "admin") : null);
  });

  registerMockRoute("GET", "/ads/accounts/:accountId", (request) => {
    const { account, role } = requireAccountAccess(request, "account:view");
    return respondWithJson(200, presentAccountDetail(account, role));
  });

  registerMockRoute("PATCH", "/ads/accounts/:accountId", (request) => {
    const { account, role, userId, actorName } = requireAccountAccess(request, "account:manage");
    const body = readJsonObjectBody(request);
    const changes = [];
    if (body.name !== undefined) {
      const name = readRequiredTrimmedString(body, "name", 80);
      changes.push({ field: "Name", from: account.name, to: name });
      account.name = name;
    }
    if (typeof body.timezone === "string" && body.timezone.length < 60) {
      changes.push({ field: "Time zone", from: account.timezone, to: body.timezone });
      account.timezone = body.timezone;
    }
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "account_updated", objectType: "account", objectId: account.id, objectName: account.name, summary: "Updated account settings", changes });
    return respondWithJson(200, presentAccountDetail(account, role));
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/entitlements", (request) => {
    const { account } = requireAccountAccess(request, "account:view");
    const goldPremium = Boolean(account.business?.goldVerified);
    const now = new Date();
    return respondWithJson(200, {
      goldPremium,
      verifiedBusiness: account.kind === "business" && goldPremium,
      monthlyAdCredit: goldPremium && account.monthlyCreditMinor ? { amountMinor: account.monthlyCreditMinor, currency: account.currency } : null,
      creditRenewsAt: goldPremium ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString() : null,
    });
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/activity", (request) => {
    const { account } = requireAccountAccess(request, "account:view");
    const objectType = request.query.get("objectType");
    const entries = readMockDatabase().activity.filter((entry) => entry.accountId === account.id && (!objectType || entry.objectType === objectType));
    const page = paginateItems(entries, request, 30);
    const items = page.items.map((entry) => ({
      id: entry.id,
      objectType: entry.objectType,
      objectId: entry.objectId,
      actor: entry.actor.isSystem ? "System" : entry.actor.name,
      summary: entry.summary,
      changes: Object.fromEntries(entry.changes.map((change) => [change.field, change.to])),
      createdAt: entry.createdAt,
    }));
    return respondWithJson(200, { ...page, items });
  });
}
