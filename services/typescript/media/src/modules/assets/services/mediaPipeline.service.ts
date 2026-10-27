import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { encryptedChatMimeType, purposePolicies, type MediaKindName, type MediaPurposeName } from "../../../constants/purposePolicy.constant.js";
import { MediaRejectedError } from "../../../errors/media.error.js";
import type { JobAttempt } from "../../../interfaces/jobQueue.interface.js";
import type { ProcessedMedia } from "../../../interfaces/mediaProcessors.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { areMimeTypesCompatible, sniffMimeType } from "../../../utils/magicBytes.util.js";
import { countPdfPages, pdfContainsActiveContent } from "../../../utils/pdfPageCount.util.js";
import { findRuleForMimeType } from "../../../utils/purposePolicy.util.js";
import type { MediaAssetWithVariants } from "../models/mediaAsset.model.js";
import { mediaAssetRepository } from "../repositories/mediaAsset.repository.js";
import { derivativeBucketFor, uploadDerivatives } from "./derivativePublishing.service.js";
import { mediaEvents } from "./mediaEvents.service.js";
import { evaluateModeration } from "./moderationPolicy.service.js";
import { derivativeKeyFor } from "../../../utils/objectKeys.util.js";

const sniffBytes = 4096;

async function readHead(path: string): Promise<Uint8Array> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(sniffBytes);
    const { bytesRead } = await handle.read(buffer, 0, sniffBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function sha256OfFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

export async function rejectAsset(context: HandlerContext, asset: MediaAssetWithVariants, reason: string, scanResult?: string): Promise<void> {
  const now = context.clock.now();
  await context.database.transaction(async (transaction) => {
    await mediaAssetRepository.update(transaction, asset.id, { status: "rejected", rejectionReason: reason, processedAt: now, ...(scanResult === undefined ? {} : { scanResult }) });
    await mediaEvents.rejected(transaction, asset, reason, now);
  });
  await context.storage.deleteObject(asset.quarantineBucket, asset.quarantineKey).catch(() => undefined);
}

async function inspectOriginal(asset: MediaAssetWithVariants, inputPath: string): Promise<{ readonly kind: MediaKindName; readonly sniffedMimeType: string; readonly maximumDurationSeconds: number | undefined }> {
  const purpose = asset.purpose as MediaPurposeName;
  if (asset.kind === "encrypted") return inspectEncryptedBlob(asset, inputPath);
  const sniffed = sniffMimeType(await readHead(inputPath));
  if (sniffed === undefined) throw new MediaRejectedError("UNRECOGNIZED_FILE_TYPE");
  if (!areMimeTypesCompatible(asset.declaredMimeType, sniffed)) throw new MediaRejectedError("TYPE_MISMATCH");
  const rule = findRuleForMimeType(purpose, sniffed);
  if (rule === undefined) throw new MediaRejectedError("TYPE_NOT_ALLOWED");
  const size = (await stat(inputPath)).size;
  if (size > rule.maximumBytes) throw new MediaRejectedError("FILE_TOO_LARGE");
  if (size !== Number(asset.sizeBytes)) throw new MediaRejectedError("SIZE_MISMATCH");
  if (asset.sha256 !== null && (await sha256OfFile(inputPath)) !== asset.sha256.toLowerCase()) throw new MediaRejectedError("CHECKSUM_MISMATCH");
  return { kind: rule.kind, sniffedMimeType: sniffed, maximumDurationSeconds: rule.maximumDurationSeconds };
}

async function inspectEncryptedBlob(asset: MediaAssetWithVariants, inputPath: string): Promise<{ readonly kind: MediaKindName; readonly sniffedMimeType: string; readonly maximumDurationSeconds: undefined }> {
  const rule = findRuleForMimeType(asset.purpose as MediaPurposeName, asset.declaredMimeType);
  if (rule?.kind !== "encrypted") throw new MediaRejectedError("TYPE_NOT_ALLOWED");
  const size = (await stat(inputPath)).size;
  if (size > rule.maximumBytes) throw new MediaRejectedError("FILE_TOO_LARGE");
  if (size !== Number(asset.sizeBytes)) throw new MediaRejectedError("SIZE_MISMATCH");
  if (asset.sha256 !== null && (await sha256OfFile(inputPath)) !== asset.sha256.toLowerCase()) throw new MediaRejectedError("CHECKSUM_MISMATCH");
  return { kind: "encrypted", sniffedMimeType: encryptedChatMimeType, maximumDurationSeconds: undefined };
}

async function produceDerivatives(context: HandlerContext, kind: MediaKindName, inputPath: string, workDirectory: string, purpose: MediaPurposeName, maximumDurationSeconds: number | undefined): Promise<ProcessedMedia> {
  if (kind === "encrypted") {
    const sizeBytes = (await stat(inputPath)).size;
    return { width: 0, height: 0, files: [{ name: "original.bin", contentType: "application/octet-stream", format: "bin", width: 0, height: 0, isVariant: true, source: { path: inputPath }, sizeBytes }], moderationFrames: [] };
  }
  const input = { inputPath, workDirectory, purpose, ...(maximumDurationSeconds === undefined ? {} : { maximumDurationSeconds }) };
  if (kind === "image") return context.images.processImage(input);
  if (kind === "video") return context.transcoder.processVideo(input);
  if (kind === "audio") return context.transcoder.processAudio(input);
  const content = await readFile(inputPath);
  if (pdfContainsActiveContent(content)) throw new MediaRejectedError("ACTIVE_CONTENT_IN_DOCUMENT");
  const pageCount = countPdfPages(content);
  if (pageCount === undefined) throw new MediaRejectedError("UNREADABLE_DOCUMENT");
  return { width: 0, height: 0, files: [{ name: "original.pdf", contentType: "application/pdf", format: "pdf", width: 0, height: 0, isVariant: true, source: { path: inputPath }, sizeBytes: content.byteLength }], moderationFrames: [], pageCount };
}

export async function runMediaPipeline(context: HandlerContext, mediaId: string, options: { readonly attempt: JobAttempt; readonly moderationApproved: boolean }): Promise<void> {
  const asset = await mediaAssetRepository.findById(context.database.client, mediaId);
  if (asset === null || !(["uploaded", "processing"].includes(asset.status) || (asset.status === "held" && options.moderationApproved))) return;
  await mediaAssetRepository.update(context.database.client, asset.id, { status: "processing" });
  const purpose = asset.purpose as MediaPurposeName;
  const policy = purposePolicies[purpose];
  const workDirectory = await mkdtemp(join(tmpdir(), "nantty-media-"));
  try {
    const inputPath = join(workDirectory, "original");
    await context.storage.downloadToFile(asset.quarantineBucket, asset.quarantineKey, inputPath);
    const inspected = await inspectOriginal(asset, inputPath);
    const scan = await context.scanner.scanFile(inputPath);
    if (scan.verdict === "infected") return await rejectAsset(context, asset, "MALWARE_DETECTED", scan.signature);
    if (scan.verdict === "skipped" && !context.config.allowUnscannedUploads) return await rejectAsset(context, asset, "MALWARE_SCAN_UNAVAILABLE", "skipped");
    const processed = await produceDerivatives(context, inspected.kind, inputPath, workDirectory, purpose, inspected.maximumDurationSeconds);
    let outcome = { decision: "allow" as "allow" | "hold" | "reject", score: null as number | null, category: null as string | null };
    if (policy.moderate && !options.moderationApproved && (inspected.kind === "image" || inspected.kind === "video")) {
      outcome = await evaluateModeration(context.moderation, context.config.moderation, { mediaId: asset.id, ownerId: asset.ownerId, purpose, kind: inspected.kind, frames: processed.moderationFrames });
    }
    const persisted = { sniffedMimeType: inspected.sniffedMimeType, kind: inspected.kind, scanResult: scan.verdict, ...(outcome.score === null ? {} : { moderationScore: outcome.score }), moderationDecision: options.moderationApproved ? "approved" : outcome.decision };
    if (outcome.decision === "reject") {
      await mediaAssetRepository.update(context.database.client, asset.id, persisted);
      return await rejectAsset(context, asset, "MODERATION_REJECTED");
    }
    if (outcome.decision === "hold") {
      const now = context.clock.now();
      await context.database.transaction(async (transaction) => {
        const held = await mediaAssetRepository.update(transaction, asset.id, { ...persisted, status: "held" });
        await mediaEvents.held(transaction, { ...asset, ...held }, outcome.score, outcome.category, now);
      });
      return;
    }
    await publishProcessedAsset(context, asset, processed, persisted);
  } catch (error) {
    if (error instanceof MediaRejectedError) return await rejectAsset(context, asset, error.reason);
    if (options.attempt.isFinalAttempt) return await rejectAsset(context, asset, "PROCESSING_FAILED");
    throw error;
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

async function publishProcessedAsset(context: HandlerContext, asset: MediaAssetWithVariants, processed: ProcessedMedia, persisted: Record<string, unknown>): Promise<void> {
  const purpose = asset.purpose as MediaPurposeName;
  const retentionDays = purposePolicies[purpose].retentionDays;
  const bucket = derivativeBucketFor(context, asset.isPrivate);
  const now = context.clock.now();
  await uploadDerivatives(context, asset.id, asset.isPrivate, processed.files);
  await context.database.transaction(async (transaction) => {
    await transaction.mediaVariant.deleteMany({ where: { assetId: asset.id } });
    await transaction.mediaVariant.createMany({
      data: processed.files.filter((file) => file.isVariant).map((file) => ({ assetId: asset.id, bucket, key: derivativeKeyFor(asset.id, asset.isPrivate, file.name), format: file.format, width: file.width, height: file.height, bitrateKbps: file.bitrateKbps ?? null, sizeBytes: file.sizeBytes })),
    });
    await mediaAssetRepository.update(transaction, asset.id, {
      ...persisted, status: "ready", width: processed.width, height: processed.height, processedAt: now, rejectionReason: null,
      ...(processed.blurhash === undefined ? {} : { blurhash: processed.blurhash }), ...(processed.durationSeconds === undefined ? {} : { durationSeconds: processed.durationSeconds }), ...(processed.pageCount === undefined ? {} : { pageCount: processed.pageCount }),
      ...(processed.posterName === undefined ? {} : { posterKey: derivativeKeyFor(asset.id, asset.isPrivate, processed.posterName) }),
      ...(processed.hlsMasterName === undefined ? {} : { hlsKey: derivativeKeyFor(asset.id, asset.isPrivate, processed.hlsMasterName) }),
      ...(retentionDays === undefined ? {} : { expiresAt: new Date(now.getTime() + retentionDays * 86_400_000) }),
    });
    const ready = await mediaAssetRepository.findById(transaction, asset.id);
    if (ready !== null) await mediaEvents.processed(transaction, ready, now);
  });
  await context.storage.deleteObject(asset.quarantineBucket, asset.quarantineKey).catch(() => undefined);
}
