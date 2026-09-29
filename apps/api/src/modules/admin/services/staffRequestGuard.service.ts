import { parseBearerToken } from "@zudojs/auth";
import type { HttpMiddlewareContext, HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { AppSettings } from "../../../configs/settings.config.js";
import { platformRoleGrantsPermission } from "../../../constants/platformRoles.constant.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { PlatformStaffAccessCheck, StaffRouteRequirement } from "../../../interfaces/platformStaffAccess.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import { adminError } from "../../../utils/adminHttp.util.js";
import { hashesAreEqual, hashSecretWithKey } from "../../../utils/hashToken.util.js";
import { runWithAuditRequestContext, type AuditRequestContext } from "../../audit/services/auditRequestContext.service.js";
import type { StaffAccountRecord, StaffSessionRecord } from "../models/platformStaff.model.js";
import type { StaffAccountsRepository } from "../repositories/staffAccounts.repository.js";
import type { StaffSecurityRepository } from "../repositories/staffSecurity.repository.js";
import type { AdminTokenService } from "./adminTokens.service.js";
import { ipAddressIsInAllowList } from "./ipAllowList.service.js";

const STAFF_STATE_KEY = "platformStaff";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const LAST_SEEN_REFRESH_MS = 60_000;

export interface StaffRequestState {
  readonly principal: Principal;
  readonly account: StaffAccountRecord;
  readonly session: StaffSessionRecord;
  readonly stepUpVerified: boolean;
  readonly ipAddress: string | null;
  readonly requestId: string | null;
}

export function findStaffRequestState(ctx: HttpRouterContext | HttpMiddlewareContext): StaffRequestState | undefined {
  return ctx.state.get(STAFF_STATE_KEY) as StaffRequestState | undefined;
}

export function requireStaffRequestState(ctx: HttpRouterContext): StaffRequestState {
  const state = findStaffRequestState(ctx);
  if (state === undefined) throw adminError(401, "AUTH_REQUIRED", "Sign in to the admin console.");
  return state;
}

export function staffIpAddressIsAllowed(settings: AppSettings["platformAdmin"], account: StaffAccountRecord, ipAddress: string | null): boolean {
  return ipAddressIsInAllowList(ipAddress, settings.ipAllowList) && ipAddressIsInAllowList(ipAddress, account.ipAllowList);
}

export class StaffRequestGuard implements PlatformStaffAccessCheck {
  public constructor(
    private readonly tokens: AdminTokenService,
    private readonly accounts: StaffAccountsRepository,
    private readonly security: StaffSecurityRepository,
    private readonly settings: AppSettings["platformAdmin"],
    private readonly audit: AuditRecorder,
    private readonly clock: Clock,
    private readonly stepUpHashKey: Uint8Array,
  ) {}

  public async handleStaffRequest(context: HttpMiddlewareContext, requirement: StaffRouteRequirement, next: () => Promise<HttpResponseContext>): Promise<HttpResponseContext> {
    const token = parseBearerToken(context.request.getHeader("authorization"));
    if (token === null || token === undefined || token === "") throw adminError(401, "AUTH_REQUIRED", "Sign in to the admin console.");
    const principal = await this.tokens.verify(token);
    const [account, session] = await Promise.all([this.accounts.findById(principal.userId), this.tokens.findUsableSession(principal.sessionId)]);
    if (account === undefined || session === undefined) throw adminError(401, "SESSION_ENDED", "Your admin session has ended. Sign in again.");
    const ipAddress = context.request.remoteAddress ?? null;
    if (!staffIpAddressIsAllowed(this.settings, account, ipAddress)) throw adminError(403, "IP_NOT_ALLOWED", "The admin console cannot be used from this network.");
    const permitted = requirement.anyOfPermissions.length === 0 || requirement.anyOfPermissions.some((permission) => platformRoleGrantsPermission(account.role, account.permissions, permission));
    if (!permitted) throw adminError(403, "FORBIDDEN", "You do not have permission to do this.");
    const stepUpVerified = await this.stepUpHeaderIsValid(session, context.request.getHeader("x-admin-step-up"));
    if (requirement.requireStepUp && !stepUpVerified) throw adminError(403, "STEP_UP_REQUIRED", "Confirm it is you before doing this.");
    const requestId = context.request.getHeader("x-request-id")?.slice(0, 128) ?? null;
    const state: StaffRequestState = { principal, account, session, stepUpVerified, ipAddress, requestId };
    context.state.set("principal", principal);
    context.state.set(STAFF_STATE_KEY, state);
    await this.refreshLastSeen(session);
    const auditContext: AuditRequestContext = {
      actorId: account.id,
      actorKind: "ADMIN",
      actorName: account.name,
      actorRole: account.role,
      ip: ipAddress,
      requestId,
      stepUpVerified,
      recordedEntries: 0,
    };
    const response = await runWithAuditRequestContext(auditContext, next);
    const method = context.request.method.toUpperCase();
    if (MUTATING_METHODS.has(method) && auditContext.recordedEntries === 0 && response.status < 400) {
      await runWithAuditRequestContext(auditContext, () =>
        this.audit.record({ actorId: account.id, action: "admin.request", area: "access", entityType: "admin_route", entityId: `${method} ${context.request.path}`, metadata: { status: response.status } }),
      );
    }
    return response;
  }

  private async stepUpHeaderIsValid(session: StaffSessionRecord, header: string | undefined): Promise<boolean> {
    if (header === undefined || header === "" || session.stepUpTokenHash === null || session.stepUpExpiresAt === null) return false;
    if (session.stepUpExpiresAt <= this.clock.now()) return false;
    return hashesAreEqual(await hashSecretWithKey(header, this.stepUpHashKey), session.stepUpTokenHash);
  }

  private async refreshLastSeen(session: StaffSessionRecord): Promise<void> {
    const now = this.clock.now();
    if (now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_REFRESH_MS) await this.security.updateSession(session.id, { lastSeenAt: now });
  }
}
