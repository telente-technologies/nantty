import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { failConflict, readIsoNow, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { validateTrendRemovals } from "@/mocks/handlers/configuration/rankingSettingsValidation.mock";
import type { TrendingModerationSetting, TrendRemoval } from "@/types/ranking.type";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

let setting: TrendingModerationSetting = {
  key: "trending.moderation",
  version: 2,
  updatedBy: "Tolu Adeyemi",
  updatedAt: hoursAgo(5),
  value: {
    removals: [
      { kind: "hashtag", key: "buyfollowersng", country: "NG", reason: "manipulation", note: "Coordinated cluster of 140 new accounts pushing a follower-selling service.", removedAt: hoursAgo(30) },
      { kind: "headline", key: "fakebankalert", country: "", reason: "misinformation", note: "Story summarised a fake bank-closure rumour.", removedAt: hoursAgo(5) },
    ],
  },
};

const describeRemovals = (removals: readonly TrendRemoval[]) => removals.map((removal) => `${removal.kind}:${removal.key}${removal.country ? `@${removal.country}` : ""}`);

export function registerTrendingModerationMockHandlers(): void {
  registerMockRoute("GET", "/admin/trending/moderation", (request) => {
    requireMockPermission(request, "content:review", "moderation:reports");
    return respondWithJson(200, setting);
  });

  registerMockRoute("PUT", "/admin/trending/moderation", (request) => {
    requireMockPermission(request, "content:review", "moderation:reports");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    if (body["expectedVersion"] !== setting.version) failConflict("VERSION_CONFLICT", "Someone else changed trend moderation. Reload and try again.");
    const removals = validateTrendRemovals(body["value"]);
    const before = setting;
    setting = { ...setting, version: setting.version + 1, updatedBy: request.principal?.name ?? "Admin", updatedAt: readIsoNow(), value: { removals } };
    recordMockAuditEntry(request, {
      action: "platform_setting.changed",
      area: "Trust & safety",
      target: { type: "platform_setting", id: "trending.moderation", label: "Trend and headline removals" },
      reason,
      before: describeRemovals(before.value.removals),
      after: describeRemovals(removals),
    });
    return respondWithJson(200, setting);
  });
}
