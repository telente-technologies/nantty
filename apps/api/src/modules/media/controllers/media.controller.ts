import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { UnsupportedMediaTypeError } from "@zudojs/errors";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { findAuthenticatedPrincipal, requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { readRawRequestBody } from "../../../middlewares/verifyWebhookSignature.middleware.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { CompleteUploadCommand } from "../commands/completeUpload/completeUpload.command.js";
import { CreateUploadCommand } from "../commands/createUpload/createUpload.command.js";
import { DeleteMediaCommand } from "../commands/deleteMedia/deleteMedia.command.js";
import { UploadChunkCommand } from "../commands/uploadChunk/uploadChunk.command.js";
import type { UploadedChunksDto } from "../commands/uploadChunk/uploadChunk.handler.js";
import type { MediaAssetDto, UploadCompletedDto, UploadProgressDto, UploadSessionCreatedDto } from "../dtos/media.dto.js";
import { GetMediaQuery } from "../queries/getMedia/getMedia.query.js";
import { GetUploadQuery } from "../queries/getUpload/getUpload.query.js";
import {
  ChunkHashHeaderSchema,
  CreateUploadBodySchema,
  MediaParamsSchema,
  UploadChunkParamsSchema,
  UploadParamsSchema,
} from "../validators/media.validator.js";

export class MediaController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly createUpload = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateUploadBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateUploadCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<CreateUploadCommand, UploadSessionCreatedDto>(command));
  };

  public readonly uploadChunk = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = UploadChunkParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const chunkHash = ChunkHashHeaderSchema.safeParse(ctx.request.getHeader("x-chunk-sha256"));
    if (!chunkHash.success) return validationFailed(chunkHash.issues.map((issue) => ({ ...issue, path: ["X-Chunk-Sha256"] })));
    const contentType = ctx.request.getHeader("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "application/octet-stream") throw new UnsupportedMediaTypeError("Send chunks as application/octet-stream.");
    const command = new UploadChunkCommand(
      requireAuthenticatedPrincipal(ctx),
      params.data.uploadId,
      params.data.chunkIndex,
      chunkHash.data,
      readRawRequestBody(ctx.request.body),
    );
    return json(200, await this.commands.execute<UploadChunkCommand, UploadedChunksDto>(command));
  };

  public readonly getUpload = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = UploadParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new GetUploadQuery(requireAuthenticatedPrincipal(ctx), params.data.uploadId);
    return json(200, await this.queries.execute<GetUploadQuery, UploadProgressDto>(query));
  };

  public readonly completeUpload = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = UploadParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new CompleteUploadCommand(requireAuthenticatedPrincipal(ctx), params.data.uploadId);
    return json(202, await this.commands.execute<CompleteUploadCommand, UploadCompletedDto>(command));
  };

  public readonly getMedia = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MediaParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const media = await this.queries.execute<GetMediaQuery, MediaAssetDto>(new GetMediaQuery(findAuthenticatedPrincipal(ctx), params.data.mediaId));
    const response = json(200, media);
    response.setHeader("cache-control", "private, no-cache");
    return response;
  };

  public readonly remove = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MediaParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<DeleteMediaCommand, void>(new DeleteMediaCommand(requireAuthenticatedPrincipal(ctx), params.data.mediaId));
    return empty(204);
  };
}
