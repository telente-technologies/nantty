import { createResponseContext, type HttpMiddleware } from "@nantty/fastify-platform";

export function createRequestSizeLimitMiddleware(maximumBytes: number): HttpMiddleware {
  return (context, next) => {
    const header = context.request.getHeader("content-length");
    if (header !== undefined && !/^\d+$/.test(header.trim())) {
      return createResponseContext({ status: 400 }).json({ message: "The Content-Length header is invalid.", code: "INVALID_CONTENT_LENGTH" });
    }
    const declared = header === undefined ? 0 : Number(header.trim());
    const actual = context.request.body instanceof Uint8Array ? context.request.body.byteLength : 0;
    if (declared > maximumBytes || actual > maximumBytes) {
      return createResponseContext({ status: 413 }).json({ message: "Request body is too large.", code: "PAYLOAD_TOO_LARGE" });
    }
    return next();
  };
}
