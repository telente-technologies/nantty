import type { Container } from "../../../container.js";
import type { RouteDefinition } from "../../../types/route.type.js";
import { UnsubscribeController } from "../controllers/unsubscribe.controller.js";

export function createUnsubscribeRoutes(container: Container): readonly RouteDefinition[] {
  const controller = new UnsubscribeController(container);
  return [
    { method: "GET", path: "/api/v1/email/unsubscribe", handler: controller.describe },
    { method: "POST", path: "/api/v1/email/unsubscribe", handler: controller.unsubscribe },
  ];
}
