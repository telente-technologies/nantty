import type { Container } from "../../../container.js";
import { requireAnyPermission, requireStepUp } from "../../../middlewares/staffAuth.middleware.js";
import type { RouteContext } from "../../../types/route.type.js";
import { json, readJsonBody } from "../../../utils/http.util.js";
import { parseWithSchema } from "../../inbox/validators/inbox.validator.js";
import { previewAdminEmailBodySchema, sendAdminEmailBodySchema } from "../validators/adminEmail.validator.js";

const emailPermissions = ["support:email", "marketing:email"] as const;

export class AdminEmailController {
  public constructor(private readonly container: Container) {}

  private async staff(context: RouteContext) {
    const staff = await this.container.staffAuthenticator.authenticate(context.request);
    requireAnyPermission(staff, emailPermissions);
    return staff;
  }

  public listTemplates = async (context: RouteContext) => {
    await this.staff(context);
    return json(200, this.container.listAdminEmailReferenceData.listTemplates());
  };

  public listSegments = async (context: RouteContext) => {
    await this.staff(context);
    return json(200, await this.container.listAdminEmailReferenceData.listSegments());
  };

  public listSends = async (context: RouteContext) => {
    await this.staff(context);
    return json(200, await this.container.listAdminEmailSends.execute());
  };

  public listFailedDeliveries = async (context: RouteContext) => {
    await this.staff(context);
    return json(200, { deliveries: await this.container.listFailedEmailDeliveries.execute() });
  };

  public preview = async (context: RouteContext) => {
    await this.staff(context);
    return json(200, await this.container.previewAdminEmail.execute(parseWithSchema(previewAdminEmailBodySchema, readJsonBody(context.request))));
  };

  public send = async (context: RouteContext) => {
    const staff = await this.staff(context);
    const body = parseWithSchema(sendAdminEmailBodySchema, readJsonBody(context.request));
    if (body.kind === "MARKETING") requireAnyPermission(staff, ["marketing:email"]);
    if (body.kind === "MARKETING" || body.audience.type === "SEGMENT") requireStepUp(staff);
    return json(201, await this.container.queueAdminEmail.execute({ ...body, actor: { id: staff.id, name: staff.name } }));
  };
}
