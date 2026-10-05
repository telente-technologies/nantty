import type { Container } from "../../../container.js";
import { requireAnyPermission } from "../../../middlewares/staffAuth.middleware.js";
import type { RouteContext } from "../../../types/route.type.js";
import { json, readJsonBody, readQuery } from "../../../utils/http.util.js";
import { parseWithSchema } from "../../inbox/validators/inbox.validator.js";
import { emailPreviewThemeSchema, policyUpdatedPreviewBodySchema } from "../validators/emailTemplates.validator.js";

const cataloguePermissions = ["support:email"] as const;
const policyPreviewPermissions = ["support:email", "legal.documents.view", "legal.documents.edit", "legal.notices.send"] as const;

export class EmailTemplatesController {
  public constructor(private readonly container: Container) {}

  private async staff(context: RouteContext, permissions: readonly string[]) {
    const staff = await this.container.staffAuthenticator.authenticate(context.request);
    requireAnyPermission(staff, permissions);
    return staff;
  }

  public listCatalogue = async (context: RouteContext) => {
    await this.staff(context, cataloguePermissions);
    return json(200, this.container.previewEmailTemplate.listCatalogue());
  };

  public previewSample = async (context: RouteContext) => {
    await this.staff(context, cataloguePermissions);
    const theme = emailPreviewThemeSchema.parse(readQuery(context.request).get("theme") ?? "light");
    return json(200, await this.container.previewEmailTemplate.previewSample(context.params["key"] ?? "", theme));
  };

  public previewPolicyUpdated = async (context: RouteContext) => {
    await this.staff(context, policyPreviewPermissions);
    return json(200, await this.container.previewEmailTemplate.previewPolicyUpdated(parseWithSchema(policyUpdatedPreviewBodySchema, readJsonBody(context.request))));
  };
}
