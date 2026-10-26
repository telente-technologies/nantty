import { findRecordInAccount, requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { appendMockActivity, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, failValidation, paginateItems, readIsoNow, readJsonObjectBody, readRequiredTrimmedString, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { AutomatedRule, ConversionEventType, ExperimentMetric, ExperimentVariable, RuleCondition, RuleLevel } from "@/types/tools.type";

const eventTypes: readonly ConversionEventType[] = ["purchase", "add_to_cart", "checkout_started", "message_started", "profile_follow", "store_visit"];
const ruleMetrics = ["cpc", "cpm", "ctr", "spend", "cost_per_result", "frequency", "roas", "impressions"];
const ruleWindows = ["today", "last_3_days", "last_7_days", "lifetime"];

function stripAccountId<Record extends { accountId: string }>({ accountId: _accountId, ...rest }: Record) {
  return rest;
}

function readRuleInput(body: Record<string, unknown>, accountId: string): Pick<AutomatedRule, "name" | "level" | "targetIds" | "conditions" | "action" | "checkEveryMinutes"> {
  const name = readRequiredTrimmedString(body, "name", 100);
  const level: RuleLevel = body.level === "campaign" || body.level === "ad_set" ? body.level : "ad";
  const targetIds = Array.isArray(body.targetIds) ? body.targetIds.filter((id): id is string => typeof id === "string").slice(0, 100) : [];
  const database = readMockDatabase();
  const collection = level === "campaign" ? database.campaigns : level === "ad_set" ? database.adSets : database.ads;
  if (targetIds.some((id) => !collection.some((record) => record.id === id && record.accountId === accountId))) failValidation("targetIds", "Some selected items are not in this ad account.");
  const conditions = (Array.isArray(body.conditions) ? body.conditions : []).slice(0, 5).map((raw, index) => {
    const condition = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>;
    if (!ruleMetrics.includes(String(condition.metric))) failValidation(`conditions.${index}.metric`, "Choose a metric.");
    if (condition.operator !== "greater_than" && condition.operator !== "less_than") failValidation(`conditions.${index}.operator`, "Choose greater than or less than.");
    if (typeof condition.value !== "number" || !Number.isFinite(condition.value) || condition.value < 0) failValidation(`conditions.${index}.value`, "Enter a number.");
    if (!ruleWindows.includes(String(condition.window))) failValidation(`conditions.${index}.window`, "Choose a time window.");
    return condition as unknown as RuleCondition;
  });
  if (conditions.length === 0) failValidation("conditions", "Add at least one condition.");
  const rawAction = (typeof body.action === "object" && body.action ? body.action : {}) as Record<string, unknown>;
  const actionType = ["pause", "notify", "increase_budget", "decrease_budget"].includes(String(rawAction.type)) ? (rawAction.type as AutomatedRule["action"]["type"]) : failValidation("action.type", "Choose an action.");
  const percent = actionType === "increase_budget" || actionType === "decrease_budget" ? Number(rawAction.percent) : null;
  if (percent !== null && (!Number.isInteger(percent) || percent < 1 || percent > 100)) failValidation("action.percent", "Choose 1% to 100%.");
  if ((actionType === "increase_budget" || actionType === "decrease_budget") && level === "ad") failValidation("action.type", "Budgets can only change on campaigns or ad sets.");
  const checkEveryMinutes = body.checkEveryMinutes === 30 || body.checkEveryMinutes === 1440 ? body.checkEveryMinutes : 60;
  return { name, level, targetIds, conditions, action: { type: actionType, percent }, checkEveryMinutes };
}

export function registerToolMockHandlers(): void {
  registerMockRoute("GET", "/ads/accounts/:accountId/conversion-events", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const page = paginateItems(readMockDatabase().conversionEvents.filter((event) => event.accountId === account.id), request);
    return respondWithJson(200, { ...page, items: page.items.map(stripAccountId) });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/conversion-events", (request) => {
    const { account } = requireAccountAccess(request, "tools:manage");
    if (!account.business) throw new MockHttpError(409, "STORE_REQUIRED", "Conversion events need a business ad account linked to a Nantty store.");
    const body = readJsonObjectBody(request);
    const eventType = eventTypes.includes(body.eventType as ConversionEventType) ? (body.eventType as ConversionEventType) : failValidation("eventType", "Choose an event type.");
    const event = { id: createMockId("cev"), accountId: account.id, name: readRequiredTrimmedString(body, "name", 80), eventType, storeId: account.business.storeId, storeName: account.business.storeName, isBuiltIn: false, status: "no_recent_activity" as const, lastReceivedAt: null, countLast7Days: 0, tracksValue: body.tracksValue === true };
    readMockDatabase().conversionEvents.push(event);
    return respondWithJson(201, stripAccountId(event));
  });

  registerMockRoute("PATCH", "/ads/accounts/:accountId/conversion-events/:eventId", (request) => {
    const { account } = requireAccountAccess(request, "tools:manage");
    const event = findRecordInAccount(readMockDatabase().conversionEvents, account.id, request.params.eventId, "conversion event");
    const body = readJsonObjectBody(request);
    if (event.isBuiltIn && body.status === "paused") throw new MockHttpError(409, "BUILT_IN_EVENT", "Built-in store events cannot be paused.");
    if (typeof body.name === "string") Object.assign(event, { name: readRequiredTrimmedString(body, "name", 80) });
    if (body.status === "active" || body.status === "paused") Object.assign(event, { status: body.status });
    return respondWithJson(200, stripAccountId(event));
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/experiments", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const page = paginateItems(readMockDatabase().experiments.filter((experiment) => experiment.accountId === account.id), request);
    return respondWithJson(200, { ...page, items: page.items.map(stripAccountId) });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/experiments", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "tools:manage");
    const body = readJsonObjectBody(request);
    const database = readMockDatabase();
    const campaign = findRecordInAccount(database.campaigns, account.id, String(body.campaignId ?? ""), "campaign");
    const rawArms = Array.isArray(body.arms) ? body.arms.slice(0, 5) : [];
    if (rawArms.length < 2) failValidation("arms", "Choose at least two ad sets to compare.");
    const arms = rawArms.map((raw, index) => {
      const arm = (typeof raw === "object" && raw ? raw : {}) as Record<string, unknown>;
      const adSet = findRecordInAccount(database.adSets, account.id, String(arm.adSetId ?? ""), "ad set");
      if (adSet.campaignId !== campaign.id) failValidation(`arms.${index}.adSetId`, "Every ad set must belong to the chosen campaign.");
      if (adSet.experimentId) failValidation(`arms.${index}.adSetId`, `"${adSet.name}" is already in another test.`);
      return { adSetId: adSet.id, adSetName: adSet.name, trafficPercent: Number(arm.trafficPercent) || 0, note: "" };
    });
    if (new Set(arms.map((arm) => arm.adSetId)).size !== arms.length) failValidation("arms", "Choose different ad sets for each side.");
    if (arms.reduce((total, arm) => total + arm.trafficPercent, 0) !== 100) failValidation("arms", "Traffic split must add up to 100%.");
    const startAt = String(body.startAt ?? "");
    const endAt = String(body.endAt ?? "");
    if (Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt)) || Date.parse(endAt) - Date.parse(startAt) < 4 * 86_400_000) failValidation("endAt", "Tests need to run for at least 4 days.");
    const variable: ExperimentVariable = ["audience", "creative", "placement", "bid_strategy"].includes(String(body.variable)) ? (body.variable as ExperimentVariable) : "audience";
    const metric: ExperimentMetric = ["cost_per_result", "ctr", "roas", "conversions"].includes(String(body.metric)) ? (body.metric as ExperimentMetric) : "cost_per_result";
    const experiment = { id: createMockId("exp"), accountId: account.id, name: readRequiredTrimmedString(body, "name", 100), campaignId: campaign.id, campaignName: campaign.name, variable, metric, status: Date.parse(startAt) <= Date.now() ? ("running" as const) : ("draft" as const), arms, startAt, endAt, result: null, createdAt: readIsoNow() };
    database.experiments.unshift(experiment);
    for (const arm of arms) {
      const adSet = database.adSets.find((candidate) => candidate.id === arm.adSetId);
      if (adSet) adSet.experimentId = experiment.id;
    }
    appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "experiment_created", objectType: "experiment", objectId: experiment.id, objectName: experiment.name, summary: `Started an A/B test on ${variable.replace("_", " ")}`, changes: [] });
    return respondWithJson(201, stripAccountId(experiment));
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/experiments/:experimentId/stop", (request) => {
    const { account } = requireAccountAccess(request, "tools:manage");
    const database = readMockDatabase();
    const experiment = findRecordInAccount(database.experiments, account.id, request.params.experimentId, "test");
    if (experiment.status !== "running" && experiment.status !== "draft") throw new MockHttpError(409, "NOT_RUNNING", "This test has already ended.");
    Object.assign(experiment, { status: "stopped", endAt: readIsoNow() });
    for (const adSet of database.adSets.filter((candidate) => candidate.experimentId === experiment.id)) adSet.experimentId = null;
    return respondWithJson(200, stripAccountId(experiment));
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/rules", (request) => {
    const { account } = requireAccountAccess(request, "campaigns:view");
    const page = paginateItems(readMockDatabase().rules.filter((rule) => rule.accountId === account.id), request);
    return respondWithJson(200, { ...page, items: page.items.map(stripAccountId) });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/rules", (request) => {
    const { account } = requireAccountAccess(request, "tools:manage");
    const rule = { ...readRuleInput(readJsonObjectBody(request), account.id), id: createMockId("rul"), accountId: account.id, status: "active" as const, lastRunAt: null, lastTriggeredAt: null, triggerCount: 0, createdAt: readIsoNow() };
    readMockDatabase().rules.unshift(rule);
    return respondWithJson(201, stripAccountId(rule));
  });

  registerMockRoute("PATCH", "/ads/accounts/:accountId/rules/:ruleId", (request) => {
    const { account } = requireAccountAccess(request, "tools:manage");
    const rule = findRecordInAccount(readMockDatabase().rules, account.id, request.params.ruleId, "rule");
    const body = readJsonObjectBody(request);
    if (body.name !== undefined || body.conditions !== undefined) Object.assign(rule, readRuleInput({ ...rule, ...body }, account.id));
    if (body.status === "active" || body.status === "paused") Object.assign(rule, { status: body.status });
    return respondWithJson(200, stripAccountId(rule));
  });

  registerMockRoute("DELETE", "/ads/accounts/:accountId/rules/:ruleId", (request) => {
    const { account } = requireAccountAccess(request, "tools:manage");
    const database = readMockDatabase();
    const rule = findRecordInAccount(database.rules, account.id, request.params.ruleId, "rule");
    database.rules.splice(database.rules.indexOf(rule), 1);
    return respondWithNoContent();
  });
}
