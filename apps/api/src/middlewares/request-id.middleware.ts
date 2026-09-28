import type { HttpMiddleware } from "@zudojs/http";

export function addRequestIdResponseHeader(): HttpMiddleware {
  return async (context, next) => {
    const response = (await next()).clone();
    response.setHeader("x-request-id", context.request.id);
    return response;
  };
}
