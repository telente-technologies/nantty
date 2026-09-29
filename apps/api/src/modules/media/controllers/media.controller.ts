import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { createResponseContext, type HttpResponseContext, type HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { readRawRequestBody } from "../../../middlewares/verifyWebhookSignature.middleware.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { ConfirmUploadCommand } from "../commands/confirmUpload/confirmUpload.command.js";
import { CreateUploadUrlCommand } from "../commands/createUploadUrl/createUploadUrl.command.js";
import { DeleteMediaCommand } from "../commands/deleteMedia/deleteMedia.command.js";
import type { MediaDto, UploadInstructionsDto } from "../dtos/media.dto.js";
import type { MediaFile } from "../queries/getMedia/getMedia.handler.js";
import { GetMediaQuery } from "../queries/getMedia/getMedia.query.js";
import { CreateUploadBodySchema, MediaParamsSchema, UploadQuerySchema } from "../validators/media.validator.js";

export class MediaController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly createUpload = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateUploadBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateUploadUrlCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<CreateUploadUrlCommand, UploadInstructionsDto>(command));
  };

  public readonly upload = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MediaParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = UploadQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const command = new ConfirmUploadCommand(
      params.data.id,
      query.data.expires,
      query.data.signature,
      ctx.request.getHeader("content-type"),
      readRawRequestBody(ctx.request.body),
    );
    return json(200, await this.commands.execute<ConfirmUploadCommand, MediaDto>(command));
  };

  public readonly download = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MediaParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const file = await this.queries.execute<GetMediaQuery, MediaFile>(new GetMediaQuery(params.data.id));
    return createResponseContext({
      status: 200,
      headers: {
        "content-type": file.media.contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
      body: file.bytes,
    });
  };

  public readonly remove = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = MediaParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<DeleteMediaCommand, void>(new DeleteMediaCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };
}
