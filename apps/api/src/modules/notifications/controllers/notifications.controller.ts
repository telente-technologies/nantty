import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { UpdatePreferencesCommand } from "../../users/commands/updatePreferences/updatePreferences.command.js";
import type { UserRecord } from "../../users/models/users.model.js";
import { GetMeQuery } from "../../users/queries/getMe/getMe.query.js";
import { MarkAllNotificationsReadCommand } from "../commands/markAllNotificationsRead/markAllNotificationsRead.command.js";
import { MarkNotificationReadCommand } from "../commands/markNotificationRead/markNotificationRead.command.js";
import { RegisterDeviceTokenCommand } from "../commands/registerDeviceToken/registerDeviceToken.command.js";
import { RemoveDeviceTokenCommand } from "../commands/removeDeviceToken/removeDeviceToken.command.js";
import { convertNotificationToDto } from "../dtos/notifications.dto.js";
import type { NotificationRecord, UnreadNotificationCounts } from "../models/notifications.model.js";
import { GetUnreadCountQuery } from "../queries/getUnreadCount/getUnreadCount.query.js";
import { ListNotificationsQuery } from "../queries/listNotifications/listNotifications.query.js";
import {
  DeviceTokenParamsSchema,
  ListNotificationsQuerySchema,
  NotificationParamsSchema,
  RegisterDeviceTokenBodySchema,
  UpdateNotificationPreferencesBodySchema,
} from "../validators/notifications.validator.js";

export class NotificationsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListNotificationsQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { limit, cursor, category, unreadOnly } = query.data;
    const page = await this.queries.execute<ListNotificationsQuery, Page<NotificationRecord>>(
      new ListNotificationsQuery(
        requireAuthenticatedPrincipal(ctx),
        { ...(category === undefined ? {} : { category }), ...(unreadOnly === undefined ? {} : { unreadOnly }) },
        buildPageRequest({ ...(limit === undefined ? {} : { limit }), ...(cursor === undefined ? {} : { cursor }) }),
      ),
    );
    return json(200, mapPageItems(page, convertNotificationToDto));
  };

  public readonly unreadCount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const counts = await this.queries.execute<GetUnreadCountQuery, UnreadNotificationCounts>(new GetUnreadCountQuery(requireAuthenticatedPrincipal(ctx)));
    return json(200, counts);
  };

  public readonly markRead = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = NotificationParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<MarkNotificationReadCommand, void>(new MarkNotificationReadCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly markAllRead = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const updated = await this.commands.execute<MarkAllNotificationsReadCommand, number>(new MarkAllNotificationsReadCommand(requireAuthenticatedPrincipal(ctx)));
    return json(200, { updated });
  };

  public readonly registerDeviceToken = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = RegisterDeviceTokenBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new RegisterDeviceTokenCommand(requireAuthenticatedPrincipal(ctx), body.data.token, body.data.platform);
    await this.commands.execute<RegisterDeviceTokenCommand, void>(command);
    return empty(204);
  };

  public readonly removeDeviceToken = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = DeviceTokenParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<RemoveDeviceTokenCommand, void>(new RemoveDeviceTokenCommand(requireAuthenticatedPrincipal(ctx), params.data.token));
    return empty(204);
  };

  public readonly getPreferences = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const user = await this.queries.execute<GetMeQuery, UserRecord>(new GetMeQuery(requireAuthenticatedPrincipal(ctx)));
    return json(200, user.settings.notifications);
  };

  public readonly updatePreferences = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = UpdateNotificationPreferencesBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdatePreferencesCommand(requireAuthenticatedPrincipal(ctx), { notifications: body.data });
    const user = await this.commands.execute<UpdatePreferencesCommand, UserRecord>(command);
    return json(200, user.settings.notifications);
  };
}
