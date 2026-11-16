import type { Container } from "../../../container.js";
import { validationError } from "../../../errors/notifications.error.js";
import type { RouteContext } from "../../../types/route.type.js";
import { json, readQuery } from "../../../utils/http.util.js";

export class UnsubscribeController {
  public constructor(private readonly container: Container) {}

  public describe = async ({ request }: RouteContext) => {
    const token = readQuery(request).get("token") ?? "";
    const valid = this.container.unsubscribeTokens.verify(token) !== null;
    return json(valid ? 200 : 400, valid ? { valid: true, confirmationRequired: true } : { message: "This unsubscribe link is not valid.", code: "VALIDATION_FAILED" });
  };

  public unsubscribe = async ({ request }: RouteContext) => {
    const bodyToken =
      typeof request.body === "object" && request.body !== null && "token" in request.body && typeof (request.body as { readonly token?: unknown }).token === "string"
        ? (request.body as { readonly token: string }).token.trim()
        : "";
    const token = bodyToken !== "" ? bodyToken : (readQuery(request).get("token") ?? "");
    if (token === "") throw validationError("token is required.");
    return json(200, await this.container.unsubscribeFromMarketing.execute({ token }));
  };
}
