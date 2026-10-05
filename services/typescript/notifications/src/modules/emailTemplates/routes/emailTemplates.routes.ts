import type { Container } from "../../../container.js";
import type { RouteDefinition } from "../../../types/route.type.js";
import { EmailTemplatesController } from "../controllers/emailTemplates.controller.js";

export function createEmailTemplateRoutes(container: Container): readonly RouteDefinition[] {
  const controller = new EmailTemplatesController(container);
  return [
    { method: "GET", path: "/api/v1/admin/email-templates", handler: controller.listCatalogue },
    { method: "POST", path: "/api/v1/admin/email-templates/policy-updated/preview", handler: controller.previewPolicyUpdated },
    { method: "GET", path: "/api/v1/admin/email-templates/:key/preview", handler: controller.previewSample },
  ];
}
