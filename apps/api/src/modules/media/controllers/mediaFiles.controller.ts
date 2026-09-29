import type { QueryBus } from "@zudojs/cqrs";
import { createRangeResponse, createResponseContext, type HttpResponseContext, type HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { validationFailed } from "../../../utils/http.util.js";
import { GetOriginalFileQuery } from "../queries/getOriginalFile/getOriginalFile.query.js";
import { GetPublicFileQuery } from "../queries/getPublicFile/getPublicFile.query.js";
import { IMMUTABLE_CACHE_CONTROL, PRIVATE_CACHE_CONTROL } from "../services/media.service.js";
import type { StoredBlob } from "../services/mediaBlobStore.service.js";
import { MediaFileParamsSchema, MediaParamsSchema } from "../validators/media.validator.js";

function respondWithFile(ctx: HttpRouterContext, file: StoredBlob, cacheControl: string, disposition: string): HttpResponseContext {
  const size = file.bytes.byteLength;
  const range = createRangeResponse(ctx.request.getHeader("range"), size);
  const headers: Record<string, string> = {
    "content-type": file.contentType ?? "application/octet-stream",
    "cache-control": cacheControl,
    "x-content-type-options": "nosniff",
    "content-disposition": disposition,
    "accept-ranges": "bytes",
  };
  if (range.status === 416) return createResponseContext({ status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
  const [firstRange] = range.ranges;
  if (range.status === 206 && firstRange !== undefined && range.ranges.length === 1) {
    return createResponseContext({
      status: 206,
      headers: { ...headers, "content-range": `bytes ${firstRange.start}-${firstRange.end}/${size}` },
      body: file.bytes.subarray(firstRange.start, firstRange.end + 1),
    });
  }
  return createResponseContext({ status: 200, headers, body: file.bytes });
}

export class MediaFilesController {
  public constructor(private readonly queries: QueryBus) {}

  public readonly downloadPublicFile = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MediaFileParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const file = await this.queries.execute<GetPublicFileQuery, StoredBlob>(new GetPublicFileQuery(params.data.key));
    return respondWithFile(ctx, file, IMMUTABLE_CACHE_CONTROL, "inline");
  };

  public readonly downloadOriginal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MediaParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new GetOriginalFileQuery(requireAuthenticatedPrincipal(ctx), params.data.mediaId);
    const file = await this.queries.execute<GetOriginalFileQuery, StoredBlob>(query);
    return respondWithFile(ctx, file, PRIVATE_CACHE_CONTROL, "attachment");
  };
}
