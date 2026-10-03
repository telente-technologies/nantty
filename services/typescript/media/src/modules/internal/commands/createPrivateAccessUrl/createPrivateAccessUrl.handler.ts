import { kycSignedUrlLifetimeSeconds, privateSignedUrlLifetimeSeconds } from "../../../../constants/media.constant.js";
import { kycPurposes, type MediaPurposeName } from "../../../../constants/purposePolicy.constant.js";
import { conflict, notFound } from "../../../../errors/media.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { derivativeKeyFor } from "../../../../utils/objectKeys.util.js";
import { mediaAssetRepository } from "../../../assets/repositories/mediaAsset.repository.js";

export interface CreatePrivateAccessUrlCommand {
  readonly mediaId: string;
  readonly actorId: string;
  readonly reason: string;
  readonly variant: string | undefined;
  readonly download: boolean;
}

export function createCreatePrivateAccessUrlHandler(context: HandlerContext): Handler<CreatePrivateAccessUrlCommand, { readonly url: string; readonly expiresAt: string }> {
  return async (command) => {
    const asset = await mediaAssetRepository.findById(context.database.client, command.mediaId);
    if (asset === null || !asset.isPrivate || asset.status === "deleted") throw notFound("MEDIA_NOT_FOUND", "Media not found");
    if (asset.status !== "ready") throw conflict("MEDIA_NOT_READY", "This file is still being processed.");
    const isKyc = kycPurposes.has(asset.purpose as MediaPurposeName);
    const lifetime = isKyc ? kycSignedUrlLifetimeSeconds : privateSignedUrlLifetimeSeconds;
    const variant = command.variant === undefined ? asset.variants.find((candidate) => candidate.format === "jpeg" || candidate.format === "pdf" || candidate.format === "mp4" || candidate.format === "m4a") ?? asset.variants[0] : asset.variants.find((candidate) => candidate.key === derivativeKeyFor(asset.id, true, command.variant as string));
    if (variant === undefined) throw notFound("VARIANT_NOT_FOUND", "That variant does not exist.");
    const expiresAt = new Date(context.clock.now().getTime() + lifetime * 1000);
    await context.database.client.mediaAccessLog.create({ data: { mediaId: asset.id, actorId: command.actorId, reason: command.reason, expiresAt } });
    const url = isKyc || command.download ? await context.storage.signGetUrl(variant.bucket, variant.key, lifetime, command.download ? `${asset.id}.${variant.format}` : undefined) : await context.urls.privateUrl(variant.bucket, variant.key, lifetime, { allowCdn: true });
    return { url, expiresAt: expiresAt.toISOString() };
  };
}
