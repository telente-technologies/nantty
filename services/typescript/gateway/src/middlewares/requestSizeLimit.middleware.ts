import { createResponseContext, type HttpMiddleware } from "@zudojs/http";

export function createRequestSizeLimitMiddleware(maximumBytes: number): HttpMiddleware {
  return (context, next) => {
    const declared = Number(context.request.getHeader("content-length") ?? "0");
    const actual = context.request.body instanceof Uint8Array ? context.request.body.byteLength : 0;
    if (declared > maximumBytes || actual > maximumBytes) {
      return createResponseContext({ status: 413 }).json({ message: "Request body is too large.", code: "PAYLOAD_TOO_LARGE" });
    }
    return next();
  };
}
