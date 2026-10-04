import { mediaEventTypes } from "../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../events/outbox.event.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import type { MediaAssetWithVariants } from "../models/mediaAsset.model.js";

const baseData = (asset: MediaAssetWithVariants) => ({ mediaId: asset.id, ownerId: asset.ownerId, purpose: asset.purpose, kind: asset.kind });

export const mediaEvents = {
  uploaded: (db: Db, asset: MediaAssetWithVariants, at: Date) =>
    appendDomainEventsToOutbox(db, [{ eventType: mediaEventTypes.uploaded, subject: asset.id, occurredAt: at, data: { ...baseData(asset), mimeType: asset.declaredMimeType, sizeBytes: Number(asset.sizeBytes), isPrivate: asset.isPrivate } }]),

  processed: (db: Db, asset: MediaAssetWithVariants, at: Date) =>
    appendDomainEventsToOutbox(db, [{
      eventType: mediaEventTypes.processed, subject: asset.id, occurredAt: at,
      data: {
        ...baseData(asset), status: "ready", isPrivate: asset.isPrivate, width: asset.width, height: asset.height,
        ...(asset.durationSeconds === null ? {} : { durationSeconds: asset.durationSeconds }), ...(asset.pageCount === null ? {} : { pageCount: asset.pageCount }),
        ...(asset.posterKey === null ? {} : { posterKey: asset.posterKey }), ...(asset.hlsKey === null ? {} : { hlsKey: asset.hlsKey }),
        variants: asset.variants.map((variant) => ({ format: variant.format, width: variant.width, height: variant.height, key: variant.key })) as Prisma.InputJsonArray,
      },
    }]),

  rejected: (db: Db, asset: MediaAssetWithVariants, reason: string, at: Date) =>
    appendDomainEventsToOutbox(db, [{ eventType: mediaEventTypes.rejected, subject: asset.id, occurredAt: at, data: { ...baseData(asset), reason } }]),

  held: (db: Db, asset: MediaAssetWithVariants, score: number | null, category: string | null, at: Date) =>
    appendDomainEventsToOutbox(db, [{ eventType: mediaEventTypes.held, subject: asset.id, occurredAt: at, data: { ...baseData(asset), score, category } }]),

  audioMuted: (db: Db, asset: MediaAssetWithVariants, claimId: string | null, at: Date) =>
    appendDomainEventsToOutbox(db, [{ eventType: mediaEventTypes.audioMuted, subject: asset.id, occurredAt: at, data: { ...baseData(asset), claimId, hlsKey: asset.hlsKey } }]),

  audioRestored: (db: Db, asset: MediaAssetWithVariants, claimId: string | null, at: Date) =>
    appendDomainEventsToOutbox(db, [{ eventType: mediaEventTypes.audioRestored, subject: asset.id, occurredAt: at, data: { ...baseData(asset), claimId, hlsKey: asset.hlsKey } }]),

  deleted: (db: Db, asset: { readonly id: string; readonly ownerId: string; readonly purpose: string }, reason: string, at: Date) =>
    appendDomainEventsToOutbox(db, [{ eventType: mediaEventTypes.deleted, subject: asset.id, occurredAt: at, data: { mediaId: asset.id, ownerId: asset.ownerId, purpose: asset.purpose, reason } }]),
};
