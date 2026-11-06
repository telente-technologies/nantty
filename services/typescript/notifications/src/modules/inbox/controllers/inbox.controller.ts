import type { Container } from "../../../container.js";
import { requireAccountId } from "../../../middlewares/gatewayPrincipal.middleware.js";
import type { RouteContext } from "../../../types/route.type.js";
import { emptyResponse, json, readBoundedLimit, readJsonBody, readQuery } from "../../../utils/http.util.js";
import {
  activityHeartbeatBodySchema, listNotificationsQuerySchema, parseWithSchema, registerDeviceTokenBodySchema, removeDeviceTokenBodySchema, updatePreferenceBodySchema,
} from "../validators/inbox.validator.js";
import type { PreferenceCategory } from "../../../types/notification.type.js";

export class InboxController {
  public constructor(private readonly container: Container) {}

  public list = async ({ request }: RouteContext) => {
    const userId = requireAccountId(request);
    const query = readQuery(request);
    const parsed = parseWithSchema(listNotificationsQuerySchema, { filter: query.get("filter") ?? undefined, cursor: query.get("cursor") });
    return json(200, await this.container.listNotifications.execute({ userId, filter: parsed.filter, cursor: parsed.cursor, limit: readBoundedLimit(query) }));
  };

  public unreadCount = async ({ request }: RouteContext) => json(200, await this.container.getUnreadCount.execute({ userId: requireAccountId(request) }));

  public markRead = async ({ request, params }: RouteContext) => {
    await this.container.markNotificationRead.execute({ userId: requireAccountId(request), notificationId: params["notificationId"] ?? "" });
    return emptyResponse();
  };

  public markAllRead = async ({ request }: RouteContext) => {
    await this.container.markAllNotificationsRead.execute({ userId: requireAccountId(request) });
    return emptyResponse();
  };

  public listPreferences = async ({ request }: RouteContext) => json(200, await this.container.listNotificationPreferences.execute({ userId: requireAccountId(request) }));

  public updatePreference = async ({ request }: RouteContext) => {
    const userId = requireAccountId(request);
    const body = parseWithSchema(updatePreferenceBodySchema, readJsonBody(request));
    return json(200, await this.container.updateNotificationPreference.execute({ userId, category: body.category as PreferenceCategory, ...(body.push === undefined ? {} : { push: body.push }), ...(body.email === undefined ? {} : { email: body.email }) }));
  };

  public registerDeviceToken = async ({ request }: RouteContext) => {
    const userId = requireAccountId(request);
    const body = parseWithSchema(registerDeviceTokenBodySchema, readJsonBody(request));
    await this.container.registerDeviceToken.execute({ userId, ...body });
    return emptyResponse();
  };

  public removeDeviceToken = async ({ request }: RouteContext) => {
    const userId = requireAccountId(request);
    const body = parseWithSchema(removeDeviceTokenBodySchema, readJsonBody(request));
    await this.container.removeDeviceToken.execute({ userId, token: body.token });
    return emptyResponse();
  };

  public recordActivity = async ({ request }: RouteContext) => {
    const userId = requireAccountId(request);
    const body = parseWithSchema(activityHeartbeatBodySchema, readJsonBody(request));
    await this.container.recordActivity.execute({ accountId: userId, timeZone: body.timeZone });
    return emptyResponse();
  };
}
