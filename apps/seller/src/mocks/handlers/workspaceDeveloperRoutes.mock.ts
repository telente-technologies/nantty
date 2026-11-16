import { randomBytes } from "node:crypto";

import { convertAccessToSellerPlan, isFeatureIncludedInPlan, type PlanFeature } from "@/config/planFeatures.config";
import { describeMockActor } from "@/mocks/handlers/settingsEntitlements.mock";
import { appendMockAuditLogEntry, readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { createMockIdentifier, MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { buildDemoWorkspaceState, type MockWorkspaceState } from "@/mocks/seed/demoWorkspaceSecurity.mock";
import { apiKeyScopes, webhookEvents, type ApiKey, type ApiKeyScope, type WebhookEndpoint, type WebhookEvent } from "@/types/developer.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

export function readMockWorkspaceState(): MockWorkspaceState {
  return readStoreScopedMockSlice("workspaceSecurity", buildDemoWorkspaceState);
}

export function assertStorePlanIncludesFeature(storeId: string, feature: PlanFeature, featureName: string): void {
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === storeId);
  const plan = convertAccessToSellerPlan({ subscription: gateStore?.subscription.subscription ?? null });
  if (!isFeatureIncludedInPlan(feature, plan)) throw new MockHttpError(402, "PLAN_FEATURE_REQUIRED", `${featureName} needs a higher plan. Upgrade in Plan & billing.`);
}

export function recordWorkspaceAudit(request: MockRequest, action: string, targetType: string, targetId: string | null, summary: string): void {
  appendMockAuditLogEntry({ actor: describeMockActor(requireMockStorePrincipal(request)), action, targetType, targetId, summary });
}

function requireDeveloperAccess(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  assertStorePlanIncludesFeature(principal.storeId, "api_webhooks", "API keys and webhooks");
  return principal;
}

function readListOfAllowedValues<Allowed extends string>(value: unknown, allowedValues: readonly Allowed[], path: string, label: string, issues: ValidationIssue[]): Allowed[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || !(allowedValues as readonly string[]).includes(entry))) {
    issues.push({ path, message: `Pick at least one ${label}.` });
    return [];
  }
  return [...new Set(value as Allowed[])];
}

function readWebhookUrl(value: unknown, issues: ValidationIssue[]): string {
  if (typeof value !== "string" || !/^https:\/\/[^\s/$.?#][^\s]{3,240}$/.test(value.trim()) || /localhost|127\.0\.0\.1|\.internal\b/.test(value)) {
    issues.push({ path: "url", message: "Use a public https:// address." });
    return "";
  }
  return value.trim();
}

function registerApiKeyRoutes(): void {
  registerMockRoute("GET", "/seller/developers/api-keys", (request) => {
    requireDeveloperAccess(request);
    return respondWithJson(200, { data: readMockWorkspaceState().apiKeys, nextCursor: null });
  });

  registerMockRoute("POST", "/seller/developers/api-keys", (request) => {
    const principal = requireDeveloperAccess(request);
    const body = readJsonObjectBody(request);
    const issues: ValidationIssue[] = [];
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 60) issues.push({ path: "name", message: "Give the key a name between 2 and 60 characters." });
    const scopes = readListOfAllowedValues<ApiKeyScope>(body.scopes, apiKeyScopes, "scopes", "scope", issues);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const state = readMockWorkspaceState();
    if (state.apiKeys.length >= 10) throw new MockHttpError(409, "API_KEY_LIMIT_REACHED", "You can have up to 10 active keys. Revoke one first.");
    const secret = `zk_live_${randomBytes(24).toString("base64url")}`;
    const apiKey: ApiKey = { id: createMockIdentifier("key"), name, prefix: secret.slice(0, 12), scopes, createdBy: principal.actorName, createdAt: new Date().toISOString(), lastUsedAt: null };
    state.apiKeys.unshift(apiKey);
    recordWorkspaceAudit(request, "developer.api_key_created", "api_key", apiKey.id, `Created API key ${name}`);
    return respondWithJson(201, { apiKey, secret });
  });

  registerMockRoute("DELETE", "/seller/developers/api-keys/:keyId", (request) => {
    requireDeveloperAccess(request);
    const state = readMockWorkspaceState();
    const apiKey = state.apiKeys.find((candidate) => candidate.id === request.params.keyId);
    if (!apiKey) throw new MockHttpError(404, "API_KEY_NOT_FOUND", "That key no longer exists.");
    state.apiKeys = state.apiKeys.filter((candidate) => candidate.id !== apiKey.id);
    recordWorkspaceAudit(request, "developer.api_key_revoked", "api_key", apiKey.id, `Revoked API key ${apiKey.name}`);
    return respondWithNoContent();
  });
}

function registerWebhookRoutes(): void {
  registerMockRoute("GET", "/seller/developers/webhooks", (request) => {
    requireDeveloperAccess(request);
    return respondWithJson(200, { data: readMockWorkspaceState().webhooks, nextCursor: null });
  });

  registerMockRoute("POST", "/seller/developers/webhooks", (request) => {
    requireDeveloperAccess(request);
    const body = readJsonObjectBody(request);
    const issues: ValidationIssue[] = [];
    const url = readWebhookUrl(body.url, issues);
    const events = readListOfAllowedValues<WebhookEvent>(body.events, webhookEvents, "events", "event", issues);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const signingSecret = `whsec_${randomBytes(24).toString("base64url")}`;
    const webhook: WebhookEndpoint = { id: createMockIdentifier("whk"), url, description: typeof body.description === "string" ? body.description.trim().slice(0, 80) : "", events, active: true, signingSecretPreview: `whsec_••••${signingSecret.slice(-4)}`, createdAt: new Date().toISOString(), lastDeliveryAt: null, recentFailureCount: 0 };
    readMockWorkspaceState().webhooks.push(webhook);
    recordWorkspaceAudit(request, "developer.webhook_created", "webhook", webhook.id, `Added webhook ${url}`);
    return respondWithJson(201, { webhook, signingSecret });
  });

  registerMockRoute("PATCH", "/seller/developers/webhooks/:webhookId", (request) => {
    requireDeveloperAccess(request);
    const state = readMockWorkspaceState();
    const current = state.webhooks.find((candidate) => candidate.id === request.params.webhookId);
    if (!current) throw new MockHttpError(404, "WEBHOOK_NOT_FOUND", "That webhook no longer exists.");
    const body = readJsonObjectBody(request);
    const issues: ValidationIssue[] = [];
    const url = body.url === undefined ? current.url : readWebhookUrl(body.url, issues);
    const events = body.events === undefined ? current.events : readListOfAllowedValues<WebhookEvent>(body.events, webhookEvents, "events", "event", issues);
    if (body.active !== undefined && typeof body.active !== "boolean") issues.push({ path: "active", message: "Active must be on or off." });
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const updated: WebhookEndpoint = { ...current, url, events, active: typeof body.active === "boolean" ? body.active : current.active };
    state.webhooks = state.webhooks.map((candidate) => (candidate.id === updated.id ? updated : candidate));
    recordWorkspaceAudit(request, "developer.webhook_updated", "webhook", updated.id, `Updated webhook ${updated.url}`);
    return respondWithJson(200, updated);
  });

  registerMockRoute("DELETE", "/seller/developers/webhooks/:webhookId", (request) => {
    requireDeveloperAccess(request);
    const state = readMockWorkspaceState();
    const webhook = state.webhooks.find((candidate) => candidate.id === request.params.webhookId);
    if (!webhook) throw new MockHttpError(404, "WEBHOOK_NOT_FOUND", "That webhook no longer exists.");
    state.webhooks = state.webhooks.filter((candidate) => candidate.id !== webhook.id);
    recordWorkspaceAudit(request, "developer.webhook_deleted", "webhook", webhook.id, `Removed webhook ${webhook.url}`);
    return respondWithNoContent();
  });

  registerMockRoute("POST", "/seller/developers/webhooks/:webhookId/test", (request) => {
    requireDeveloperAccess(request);
    const state = readMockWorkspaceState();
    const webhook = state.webhooks.find((candidate) => candidate.id === request.params.webhookId);
    if (!webhook) throw new MockHttpError(404, "WEBHOOK_NOT_FOUND", "That webhook no longer exists.");
    const delivery = { id: createMockIdentifier("whd"), webhookId: webhook.id, event: webhook.events[0] ?? "order.created", responseStatus: null, durationMilliseconds: null, outcome: "retrying" as const, attemptedAt: new Date().toISOString() };
    state.webhookDeliveries.unshift(delivery);
    return respondWithJson(201, delivery);
  });

  registerMockRoute("GET", "/seller/developers/webhook-deliveries", (request) => {
    requireDeveloperAccess(request);
    const webhookId = request.query.get("webhookId");
    const deliveries = readMockWorkspaceState().webhookDeliveries.filter((delivery) => !webhookId || delivery.webhookId === webhookId).slice(0, 50);
    return respondWithJson(200, { data: deliveries, nextCursor: null });
  });
}

export function registerWorkspaceDeveloperMockRoutes(): void {
  registerApiKeyRoutes();
  registerWebhookRoutes();
}
