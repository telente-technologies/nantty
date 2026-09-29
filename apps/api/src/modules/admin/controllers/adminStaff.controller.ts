import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { AdminReasonBodySchema, readNumberedPageRequest } from "../../../utils/adminHttp.util.js";
import { createResponseContext } from "@zudojs/http";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import type { AuditEventFilter } from "../../audit/models/audit.model.js";
import { AddAdminPasskeyCommand } from "../commands/addAdminPasskey/addAdminPasskey.command.js";
import { ChangeAdminPermissionsCommand } from "../commands/changeAdminPermissions/changeAdminPermissions.command.js";
import { CreateAdminPasskeyOptionsCommand } from "../commands/createAdminPasskeyOptions/createAdminPasskeyOptions.command.js";
import { DisableAdminCommand } from "../commands/disableAdmin/disableAdmin.command.js";
import { EnableAdminCommand } from "../commands/enableAdmin/enableAdmin.command.js";
import { ExportAdminAuditLogCommand } from "../commands/exportAdminAuditLog/exportAdminAuditLog.command.js";
import { InviteAdminCommand } from "../commands/inviteAdmin/inviteAdmin.command.js";
import { RegenerateAdminRecoveryCodesCommand } from "../commands/regenerateAdminRecoveryCodes/regenerateAdminRecoveryCodes.command.js";
import { RemoveAdminPasskeyCommand } from "../commands/removeAdminPasskey/removeAdminPasskey.command.js";
import { ResetAdminMfaCommand } from "../commands/resetAdminMfa/resetAdminMfa.command.js";
import { RevokeAdminSessionCommand } from "../commands/revokeAdminSession/revokeAdminSession.command.js";
import { GetAdminQuery } from "../queries/getAdmin/getAdmin.query.js";
import { GetAdminAccountQuery } from "../queries/getAdminAccount/getAdminAccount.query.js";
import { GetAdminAuditEntryQuery } from "../queries/getAdminAuditEntry/getAdminAuditEntry.query.js";
import { GetAdminAuditFacetsQuery } from "../queries/getAdminAuditFacets/getAdminAuditFacets.query.js";
import { ListAdminAuditLogQuery } from "../queries/listAdminAuditLog/listAdminAuditLog.query.js";
import { ListAdminSessionsQuery } from "../queries/listAdminSessions/listAdminSessions.query.js";
import { ListAdminsQuery } from "../queries/listAdmins/listAdmins.query.js";
import { requireStaffRequestState } from "../services/staffRequestGuard.service.js";
import {
  AddPasskeyBodySchema,
  AdminIdParamsSchema,
  AdminPasskeyParamsSchema,
  AdminSessionParamsSchema,
  AuditEntryParamsSchema,
  AuditLogQuerySchema,
  ChangeAdminPermissionsBodySchema,
  InviteAdminBodySchema,
  ListAdminsQuerySchema,
  type AuditLogQuery,
} from "../validators/admin.validator.js";

function buildAuditFilter(query: AuditLogQuery): AuditEventFilter {
  return {
    ...(query.search === undefined ? {} : { search: query.search }),
    ...(query.area === undefined ? {} : { area: query.area }),
    ...(query.actorId === undefined ? {} : { actorId: query.actorId }),
    ...(query.targetType === undefined ? {} : { entityType: query.targetType }),
    ...(query.targetId === undefined ? {} : { entityId: query.targetId }),
    ...(query.from === undefined ? {} : { from: new Date(query.from) }),
    ...(query.to === undefined ? {} : { to: new Date(query.to) }),
  };
}

export class AdminStaffController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly getAccount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => json(200, await this.queries.execute(new GetAdminAccountQuery(requireStaffRequestState(ctx))));

  public readonly listSessions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => json(200, await this.queries.execute(new ListAdminSessionsQuery(requireStaffRequestState(ctx))));

  public readonly revokeSession = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = AdminSessionParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute(new RevokeAdminSessionCommand(requireStaffRequestState(ctx), params.data.sessionId));
    return empty(204);
  };

  public readonly regenerateRecoveryCodes = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.commands.execute(new RegenerateAdminRecoveryCodesCommand(requireStaffRequestState(ctx))));

  public readonly passkeyOptions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.commands.execute(new CreateAdminPasskeyOptionsCommand(requireStaffRequestState(ctx))));

  public readonly addPasskey = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AddPasskeyBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(201, await this.commands.execute(new AddAdminPasskeyCommand(requireStaffRequestState(ctx), body.data.label, body.data.credential)));
  };

  public readonly removePasskey = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = AdminPasskeyParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute(new RemoveAdminPasskeyCommand(requireStaffRequestState(ctx), params.data.passkeyId));
    return empty(204);
  };

  public readonly listAdmins = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListAdminsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { search, status, role } = query.data;
    return json(200, await this.queries.execute(new ListAdminsQuery({ search, status, role }, readNumberedPageRequest(query.data))));
  };

  public readonly getAdmin = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = AdminIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute(new GetAdminQuery(params.data.adminId)));
  };

  public readonly inviteAdmin = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = InviteAdminBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(201, await this.commands.execute(new InviteAdminCommand(requireStaffRequestState(ctx), body.data)));
  };

  public readonly changePermissions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = AdminIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = ChangeAdminPermissionsBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new ChangeAdminPermissionsCommand(requireStaffRequestState(ctx), params.data.adminId, body.data.role, body.data.permissions, body.data.reason);
    return json(200, await this.commands.execute(command));
  };

  public readonly disableAdmin = (ctx: HttpRouterContext) => this.runAdminAction(ctx, (staffId, reason) => new DisableAdminCommand(requireStaffRequestState(ctx), staffId, reason));

  public readonly enableAdmin = (ctx: HttpRouterContext) => this.runAdminAction(ctx, (staffId, reason) => new EnableAdminCommand(requireStaffRequestState(ctx), staffId, reason));

  public readonly resetMfa = (ctx: HttpRouterContext) => this.runAdminAction(ctx, (staffId, reason) => new ResetAdminMfaCommand(requireStaffRequestState(ctx), staffId, reason));

  public readonly listAudit = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = AuditLogQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    return json(200, await this.queries.execute(new ListAdminAuditLogQuery(buildAuditFilter(query.data), readNumberedPageRequest(query.data))));
  };

  public readonly auditFacets = async (): Promise<HttpResponseContext> => json(200, await this.queries.execute(new GetAdminAuditFacetsQuery()));

  public readonly getAuditEntry = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = AuditEntryParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute(new GetAdminAuditEntryQuery(params.data.entryId)));
  };

  public readonly exportAudit = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = AuditLogQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const csv = await this.commands.execute<ExportAdminAuditLogCommand, string>(new ExportAdminAuditLogCommand(requireStaffRequestState(ctx), buildAuditFilter(query.data)));
    const response = createResponseContext({ status: 200 }).text(csv);
    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader("content-disposition", 'attachment; filename="audit-log.csv"');
    return response;
  };

  private async runAdminAction(ctx: HttpRouterContext, build: (staffId: string, reason: string) => DisableAdminCommand | EnableAdminCommand | ResetAdminMfaCommand): Promise<HttpResponseContext> {
    const params = AdminIdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = AdminReasonBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    return json(200, await this.commands.execute(build(params.data.adminId, body.data.reason)));
  }
}
