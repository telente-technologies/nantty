import { ApiError } from "@/errors/api.error";
import { useUploadQueueStore, type UploadJob } from "@/store/uploadQueue.store";
import type { ChunkUploadUrl, ID, MediaAsset, MediaUploadPurpose } from "@/types";

import {
  deletePreparedUploadFile,
  prepareLocalMediaForChunkedUpload,
  validateLocalMediaBeforeUpload,
  type LocalMediaFile,
} from "./mediaPreparation.service";
import { mediaUploadTransport, readChunkBytesFromLocalFile } from "./mediaUploadTransport.service";
import { DeviceOfflineError, retryWithExponentialBackoffAndJitter, runTasksWithBoundedConcurrency } from "./mediaUploadRetry.service";

const MULTIPART_PART_CONCURRENCY = 4;
const MAXIMUM_CHUNK_URLS_PER_REQUEST = 16;
const SINGLE_PUT_MAXIMUM_BYTES = 8 * 1024 * 1024;
const MAXIMUM_JOB_FAILURES_BEFORE_GIVING_UP = 5;
const MEDIA_PROCESSING_POLL_TIMEOUT_MS = 5 * 60_000;
const FINISHED_JOB_RETENTION_MS = 24 * 60 * 60_000;
const RESUMABLE_JOB_STATUSES: readonly UploadJob["status"][] = ["queued", "uploading", "waitingForNetwork"];

let activeQueueDrain: Promise<void> | null = null;
const jobIdsBeingPolledForProcessing = new Set<ID>();

const getUploadJob = (jobId: ID) => useUploadQueueStore.getState().jobsById[jobId];
const updateUploadJob = (jobId: ID, change: Parameters<ReturnType<typeof useUploadQueueStore.getState>["updateUploadJob"]>[1]) =>
  useUploadQueueStore.getState().updateUploadJob(jobId, change);
const generateUploadJobId = () => `upl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const mergeChunkIndexes = (...lists: (readonly number[])[]) => [...new Set(lists.flat())].sort((a, b) => a - b);
const describeUploadError = (error: unknown) => (error instanceof Error && error.message ? error.message : "Upload failed. Tap to retry.");

export async function enqueueLocalMediaForUpload(media: LocalMediaFile, purpose: MediaUploadPurpose): Promise<ID> {
  validateLocalMediaBeforeUpload(media, purpose);
  const jobId = generateUploadJobId();
  useUploadQueueStore.getState().addUploadJob({
    jobId,
    purpose,
    mediaType: media.mediaType,
    previewUri: media.uri,
    preparedFileUri: null,
    fileName: media.fileName ?? "upload",
    mimeType: media.mimeType ?? "",
    sizeBytes: media.sizeBytes ?? 0,
    width: media.width,
    height: media.height,
    durationSeconds: media.durationSeconds,
    uploadId: null,
    reservedMediaId: null,
    uploadMode: null,
    chunkSizeBytes: null,
    totalChunks: null,
    uploadedChunks: [],
    status: "preparing",
    mediaId: null,
    media: null,
    errorMessage: null,
    failedAttempts: 0,
    createdAt: new Date().toISOString(),
  });
  prepareFileThenQueueForUpload(jobId, media, purpose).catch(() => undefined);
  return jobId;
}

async function prepareFileThenQueueForUpload(jobId: ID, media: LocalMediaFile, purpose: MediaUploadPurpose) {
  try {
    const prepared = await prepareLocalMediaForChunkedUpload(media, purpose, jobId);
    if (!getUploadJob(jobId)) {
      deletePreparedUploadFile(prepared.fileUri);
      return;
    }
    updateUploadJob(jobId, {
      preparedFileUri: prepared.fileUri,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.sizeBytes,
      width: prepared.width,
      height: prepared.height,
      status: "queued",
    });
    startDrainingUploadQueue();
  } catch (error) {
    updateUploadJob(jobId, { status: "failed", errorMessage: describeUploadError(error) });
  }
}

export function startDrainingUploadQueue(): Promise<void> {
  activeQueueDrain ??= uploadEveryResumableJobInOrder().finally(() => {
    activeQueueDrain = null;
    const hasJobQueuedDuringDrain = Object.values(useUploadQueueStore.getState().jobsById).some((job) => job.status === "queued");
    if (hasJobQueuedDuringDrain) startDrainingUploadQueue().catch(() => undefined);
  });
  return activeQueueDrain;
}

function requeueFailedJobsThatCanStillBeRetriedAutomatically() {
  for (const job of Object.values(useUploadQueueStore.getState().jobsById)) {
    if (job.status === "failed" && job.preparedFileUri && !job.mediaId && job.failedAttempts < MAXIMUM_JOB_FAILURES_BEFORE_GIVING_UP) {
      updateUploadJob(job.jobId, { status: "queued" });
    }
  }
}

async function uploadEveryResumableJobInOrder() {
  resumeProcessingPollsForUploadedJobs();
  requeueFailedJobsThatCanStillBeRetriedAutomatically();
  const attemptedJobIds = new Set<ID>();
  for (;;) {
    const nextJob = Object.values(useUploadQueueStore.getState().jobsById)
      .filter((job) => RESUMABLE_JOB_STATUSES.includes(job.status) && !attemptedJobIds.has(job.jobId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!nextJob) return;
    attemptedJobIds.add(nextJob.jobId);
    const outcome = await uploadSingleJobUntilCompleteOrStopped(nextJob.jobId);
    if (outcome === "offline") return;
  }
}

async function openOrResumeUploadSession(job: UploadJob): Promise<UploadJob> {
  if (job.uploadId) {
    try {
      const serverStatus = await retryWithExponentialBackoffAndJitter(() => mediaUploadTransport.fetchUploadSessionStatus(job.uploadId!));
      if (serverStatus.status !== "failed") {
        updateUploadJob(job.jobId, (current) => ({ uploadedChunks: mergeChunkIndexes(current.uploadedChunks, serverStatus.uploadedChunks) }));
        if (serverStatus.media) updateUploadJob(job.jobId, { mediaId: serverStatus.media.id, media: serverStatus.media });
        return getUploadJob(job.jobId)!;
      }
    } catch (error) {
      if (!(error instanceof ApiError && (error.status === 404 || error.status === 410))) throw error;
    }
  }
  const session = await retryWithExponentialBackoffAndJitter(() =>
    mediaUploadTransport.createUploadSession({ fileName: job.fileName, mimeType: job.mimeType, sizeBytes: job.sizeBytes, purpose: job.purpose }),
  );
  const uploadMode = session.mode ?? (job.sizeBytes < SINGLE_PUT_MAXIMUM_BYTES ? "single" : "multipart");
  updateUploadJob(job.jobId, {
    uploadId: session.uploadId,
    reservedMediaId: session.mediaId ?? null,
    uploadMode,
    chunkSizeBytes: uploadMode === "single" ? Math.max(job.sizeBytes, 1) : (session.partSizeBytes ?? session.chunkSizeBytes),
    totalChunks: uploadMode === "single" ? 1 : (session.partCount ?? session.totalChunks),
    uploadedChunks: [...session.uploadedChunks],
  });
  return getUploadJob(job.jobId)!;
}

async function uploadMissingChunksForJob(job: UploadJob) {
  const { uploadId, chunkSizeBytes, totalChunks, preparedFileUri } = job;
  if (!uploadId || !chunkSizeBytes || !totalChunks || !preparedFileUri) throw new Error("Upload session is incomplete.");
  const alreadyUploaded = new Set(job.uploadedChunks);
  const missingChunkIndexes = Array.from({ length: totalChunks }, (_, index) => index).filter((index) => !alreadyUploaded.has(index));
  const bytesSentByChunkIndex = new Map<number, number>();
  const publishInFlightBytes = () =>
    useUploadQueueStore.getState().setInFlightBytesForJob(job.jobId, [...bytesSentByChunkIndex.values()].reduce((a, b) => a + b, 0));

  const prefetchedTargets = new Map<number, ChunkUploadUrl>();
  if (missingChunkIndexes.length > 1) {
    try {
      const batch = await mediaUploadTransport.fetchChunkUploadUrls(uploadId, missingChunkIndexes.slice(0, MAXIMUM_CHUNK_URLS_PER_REQUEST));
      batch.urls.forEach(({ chunkIndex, ...target }) => prefetchedTargets.set(chunkIndex, target));
    } catch {
      prefetchedTargets.clear();
    }
  }
  const concurrency = job.uploadMode === "single" ? 1 : MULTIPART_PART_CONCURRENCY;
  await runTasksWithBoundedConcurrency(missingChunkIndexes, concurrency, async (chunkIndex) => {
    const chunkOffset = chunkIndex * chunkSizeBytes;
    const chunkLength = Math.min(chunkSizeBytes, job.sizeBytes - chunkOffset);
    const chunkBytes = await readChunkBytesFromLocalFile(preparedFileUri, chunkOffset, chunkLength);
    let presignedTarget = prefetchedTargets.get(chunkIndex);
    await retryWithExponentialBackoffAndJitter(async () => {
      try {
        await mediaUploadTransport.uploadChunk(
          uploadId,
          chunkIndex,
          chunkBytes,
          (bytesSent) => {
            bytesSentByChunkIndex.set(chunkIndex, Math.min(bytesSent, chunkLength));
            publishInFlightBytes();
          },
          presignedTarget,
        );
      } catch (error) {
        presignedTarget = undefined;
        bytesSentByChunkIndex.delete(chunkIndex);
        throw error;
      }
    });
    bytesSentByChunkIndex.delete(chunkIndex);
    updateUploadJob(job.jobId, (current) => ({ uploadedChunks: mergeChunkIndexes(current.uploadedChunks, [chunkIndex]) }));
    publishInFlightBytes();
  });
}

async function uploadSingleJobUntilCompleteOrStopped(jobId: ID): Promise<"done" | "failed" | "offline"> {
  const queuedJob = getUploadJob(jobId);
  if (!queuedJob?.preparedFileUri) {
    updateUploadJob(jobId, { status: "failed", errorMessage: "The file is no longer available." });
    return "failed";
  }
  updateUploadJob(jobId, { status: "uploading", errorMessage: null });
  try {
    const jobWithSession = await openOrResumeUploadSession(queuedJob);
    if (!jobWithSession.mediaId) {
      await uploadMissingChunksForJob(jobWithSession);
      const completed = await retryWithExponentialBackoffAndJitter(() => mediaUploadTransport.completeUploadSession(jobWithSession.uploadId!));
      updateUploadJob(jobId, { mediaId: completed.mediaId });
    }
    updateUploadJob(jobId, { status: "processing" });
    useUploadQueueStore.getState().setInFlightBytesForJob(jobId, 0);
    deletePreparedUploadFile(getUploadJob(jobId)?.preparedFileUri ?? null);
    pollMediaAssetUntilProcessed(jobId);
    return "done";
  } catch (error) {
    if (error instanceof DeviceOfflineError) {
      updateUploadJob(jobId, { status: "waitingForNetwork" });
      return "offline";
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
      updateUploadJob(jobId, { uploadId: null, uploadedChunks: [], status: "queued" });
    }
    updateUploadJob(jobId, (current) => ({
      status: "failed",
      failedAttempts: current.failedAttempts + 1,
      errorMessage: describeUploadError(error),
    }));
    return "failed";
  }
}

function pollMediaAssetUntilProcessed(jobId: ID) {
  const mediaId = getUploadJob(jobId)?.mediaId;
  if (!mediaId || jobIdsBeingPolledForProcessing.has(jobId)) return;
  jobIdsBeingPolledForProcessing.add(jobId);
  const startedAt = Date.now();
  const pollOnceThenScheduleNext = async (attemptNumber: number) => {
    try {
      const asset = await mediaUploadTransport.fetchMediaAsset(mediaId);
      if (asset.status !== "processing") {
        updateUploadJob(jobId, { media: asset, status: asset.status === "ready" ? "ready" : "failed" });
        jobIdsBeingPolledForProcessing.delete(jobId);
        return;
      }
    } catch {
      if (Date.now() - startedAt > MEDIA_PROCESSING_POLL_TIMEOUT_MS) {
        jobIdsBeingPolledForProcessing.delete(jobId);
        return;
      }
    }
    if (Date.now() - startedAt > MEDIA_PROCESSING_POLL_TIMEOUT_MS) {
      jobIdsBeingPolledForProcessing.delete(jobId);
      return;
    }
    setTimeout(() => pollOnceThenScheduleNext(attemptNumber + 1), Math.min(1_000 * 1.6 ** attemptNumber, 10_000));
  };
  pollOnceThenScheduleNext(0).catch(() => jobIdsBeingPolledForProcessing.delete(jobId));
}

function resumeProcessingPollsForUploadedJobs() {
  const now = Date.now();
  for (const job of Object.values(useUploadQueueStore.getState().jobsById)) {
    const isOld = now - new Date(job.createdAt).getTime() > FINISHED_JOB_RETENTION_MS;
    if (isOld && (job.status === "ready" || job.status === "failed")) {
      deletePreparedUploadFile(job.preparedFileUri);
      useUploadQueueStore.getState().removeUploadJob(job.jobId);
    } else if (job.status === "processing") pollMediaAssetUntilProcessed(job.jobId);
  }
}

export function retryFailedUpload(jobId: ID) {
  updateUploadJob(jobId, { status: "queued", failedAttempts: 0, errorMessage: null });
  return startDrainingUploadQueue();
}

export function cancelAndRemoveUpload(jobId: ID) {
  const abandoned = getUploadJob(jobId);
  if (abandoned?.uploadId && !abandoned.mediaId) mediaUploadTransport.abortUploadSession(abandoned.uploadId).catch(() => undefined);
  deletePreparedUploadFile(getUploadJob(jobId)?.preparedFileUri ?? null);
  useUploadQueueStore.getState().removeUploadJob(jobId);
}

const waitForJobToSatisfy = <T>(jobId: ID, extractResult: (job: UploadJob) => T | null): Promise<T> =>
  new Promise((resolve, reject) => {
    const check = () => {
      const job = getUploadJob(jobId);
      if (!job) return { settled: true, run: () => reject(new Error("This upload was removed.")) };
      const result = extractResult(job);
      if (result !== null) return { settled: true, run: () => resolve(result) };
      if (job.status === "failed") return { settled: true, run: () => reject(new Error(job.errorMessage ?? "Upload failed.")) };
      return { settled: false, run: () => undefined };
    };
    const initial = check();
    if (initial.settled) return initial.run();
    const unsubscribe = useUploadQueueStore.subscribe(() => {
      const outcome = check();
      if (!outcome.settled) return;
      unsubscribe();
      outcome.run();
    });
  });

export const waitForReservedMediaId = (jobId: ID) => waitForJobToSatisfy(jobId, (job) => job.mediaId ?? job.reservedMediaId ?? null);

export const waitForUploadedMediaId = (jobId: ID) => waitForJobToSatisfy(jobId, (job) => job.mediaId);

export const waitForProcessedMediaAsset = (jobId: ID): Promise<MediaAsset> =>
  waitForJobToSatisfy(jobId, (job) => (job.status === "ready" && job.media ? job.media : null));
