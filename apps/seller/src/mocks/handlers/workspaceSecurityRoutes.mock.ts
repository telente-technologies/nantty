import { assertStorePlanIncludesFeature, readMockWorkspaceState, recordWorkspaceAudit } from "@/mocks/handlers/workspaceDeveloperRoutes.mock";
import { MockHttpError, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { StoreIntegration } from "@/types/developer.type";

function findIntegrationOrThrow(integrationId: string): StoreIntegration {
  const integration = readMockWorkspaceState().integrations.find((candidate) => candidate.id === integrationId);
  if (!integration) throw new MockHttpError(404, "INTEGRATION_NOT_FOUND", "That integration is not available.");
  return integration;
}

function replaceIntegration(updated: StoreIntegration): StoreIntegration {
  const state = readMockWorkspaceState();
  state.integrations = state.integrations.map((candidate) => (candidate.id === updated.id ? updated : candidate));
  return updated;
}

function registerSecurityRoutes(): void {
  registerMockRoute("GET", "/seller/security", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readMockWorkspaceState().security);
  });

  registerMockRoute("DELETE", "/seller/security/sessions/:sessionId", (request) => {
    requireMockStorePrincipal(request);
    const state = readMockWorkspaceState();
    const session = state.security.sessions.find((candidate) => candidate.id === request.params.sessionId);
    if (!session) throw new MockHttpError(404, "SESSION_NOT_FOUND", "That session has already ended.");
    if (session.isCurrent) throw new MockHttpError(409, "CURRENT_SESSION", "Use Sign out to end the session you are using now.");
    state.security = { ...state.security, sessions: state.security.sessions.filter((candidate) => candidate.id !== session.id) };
    recordWorkspaceAudit(request, "security.session_revoked", "session", session.id, `Signed out ${session.device}`);
    return respondWithNoContent();
  });

  registerMockRoute("POST", "/seller/security/sessions/sign-out-others", (request) => {
    requireMockStorePrincipal(request);
    const state = readMockWorkspaceState();
    const endedCount = state.security.sessions.filter((session) => !session.isCurrent).length;
    state.security = { ...state.security, sessions: state.security.sessions.filter((session) => session.isCurrent) };
    recordWorkspaceAudit(request, "security.sessions_revoked", "session", null, `Signed out ${endedCount} other sessions`);
    return respondWithJson(200, { endedCount });
  });
}

function registerIntegrationRoutes(): void {
  registerMockRoute("GET", "/seller/integrations", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, { data: readMockWorkspaceState().integrations, nextCursor: null });
  });

  registerMockRoute("POST", "/seller/integrations/:integrationId/connect", (request) => {
    const principal = requireMockStorePrincipal(request);
    const integration = findIntegrationOrThrow(request.params.integrationId ?? "");
    if (integration.requiredPlanFeature) assertStorePlanIncludesFeature(principal.storeId, integration.requiredPlanFeature, `${integration.name}`);
    const body = readJsonObjectBody(request);
    const accountLabel = typeof body.accountLabel === "string" && body.accountLabel.trim() ? body.accountLabel.trim().slice(0, 80) : principal.actorName;
    const now = new Date().toISOString();
    const updated = replaceIntegration({ ...integration, status: "connected", connectedAccount: accountLabel, connectedAt: now, lastSyncedAt: now });
    recordWorkspaceAudit(request, "integration.connected", "integration", integration.id, `Connected ${integration.name}`);
    return respondWithJson(200, updated);
  });

  registerMockRoute("POST", "/seller/integrations/:integrationId/disconnect", (request) => {
    requireMockStorePrincipal(request);
    const integration = findIntegrationOrThrow(request.params.integrationId ?? "");
    const updated = replaceIntegration({ ...integration, status: "not_connected", connectedAccount: null, connectedAt: null, lastSyncedAt: null });
    recordWorkspaceAudit(request, "integration.disconnected", "integration", integration.id, `Disconnected ${integration.name}`);
    return respondWithJson(200, updated);
  });

  registerMockRoute("POST", "/seller/integrations/:integrationId/sync", (request) => {
    requireMockStorePrincipal(request);
    const integration = findIntegrationOrThrow(request.params.integrationId ?? "");
    if (integration.status === "not_connected") throw new MockHttpError(409, "INTEGRATION_NOT_CONNECTED", "Connect this integration first.");
    return respondWithJson(200, replaceIntegration({ ...integration, status: "connected", lastSyncedAt: new Date().toISOString() }));
  });
}

export function registerWorkspaceSecurityMockRoutes(): void {
  registerSecurityRoutes();
  registerIntegrationRoutes();
}
