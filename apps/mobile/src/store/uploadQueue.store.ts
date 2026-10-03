import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ID, MediaAsset, MediaUploadPurpose } from "@/types";

export type UploadJobStatus = "preparing" | "queued" | "uploading" | "waitingForNetwork" | "processing" | "ready" | "failed";

export interface UploadJob {
  readonly jobId: ID;
  readonly purpose: MediaUploadPurpose;
  readonly mediaType: "image" | "video" | "audio";
  readonly previewUri: string;
  readonly preparedFileUri: string | null;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
  readonly uploadId: ID | null;
  readonly reservedMediaId?: ID | null;
  readonly uploadMode?: "single" | "multipart" | null;
  readonly chunkSizeBytes: number | null;
  readonly totalChunks: number | null;
  readonly uploadedChunks: readonly number[];
  readonly status: UploadJobStatus;
  readonly mediaId: ID | null;
  readonly media: MediaAsset | null;
  readonly errorMessage: string | null;
  readonly failedAttempts: number;
  readonly createdAt: string;
}

interface UploadQueueState {
  readonly jobsById: Readonly<Record<ID, UploadJob>>;
  readonly inFlightBytesByJobId: Readonly<Record<ID, number>>;
  readonly addUploadJob: (job: UploadJob) => void;
  readonly updateUploadJob: (jobId: ID, change: Partial<UploadJob> | ((job: UploadJob) => Partial<UploadJob>)) => void;
  readonly removeUploadJob: (jobId: ID) => void;
  readonly setInFlightBytesForJob: (jobId: ID, bytes: number) => void;
}

export const useUploadQueueStore = create<UploadQueueState>()(
  persist(
    (set) => ({
      jobsById: {},
      inFlightBytesByJobId: {},
      addUploadJob: (job) => set((state) => ({ jobsById: { ...state.jobsById, [job.jobId]: job } })),
      updateUploadJob: (jobId, change) =>
        set((state) => {
          const current = state.jobsById[jobId];
          if (!current) return state;
          const patch = typeof change === "function" ? change(current) : change;
          return { jobsById: { ...state.jobsById, [jobId]: { ...current, ...patch } } };
        }),
      removeUploadJob: (jobId) =>
        set((state) => {
          const { [jobId]: _removedJob, ...remainingJobs } = state.jobsById;
          const { [jobId]: _removedBytes, ...remainingBytes } = state.inFlightBytesByJobId;
          return { jobsById: remainingJobs, inFlightBytesByJobId: remainingBytes };
        }),
      setInFlightBytesForJob: (jobId, bytes) =>
        set((state) => ({ inFlightBytesByJobId: { ...state.inFlightBytesByJobId, [jobId]: bytes } })),
    }),
    {
      name: "zm.uploadQueue",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ jobsById: state.jobsById }),
    },
  ),
);

export const calculateUploadedFractionForJob = (job: UploadJob, inFlightBytes: number) => {
  if (job.status === "processing" || job.status === "ready") return 1;
  if (!job.totalChunks || !job.chunkSizeBytes || job.sizeBytes <= 0) return 0;
  const confirmedBytes = job.uploadedChunks.reduce((total, chunkIndex) => {
    const chunkStart = chunkIndex * job.chunkSizeBytes!;
    return total + Math.max(Math.min(job.chunkSizeBytes!, job.sizeBytes - chunkStart), 0);
  }, 0);
  return Math.min((confirmedBytes + inFlightBytes) / job.sizeBytes, 0.999);
};

export function useUploadJobProgress(jobId: ID | null) {
  const job = useUploadQueueStore((state) => (jobId ? state.jobsById[jobId] : undefined));
  const inFlightBytes = useUploadQueueStore((state) => (jobId ? state.inFlightBytesByJobId[jobId] ?? 0 : 0));
  return { job: job ?? null, uploadedFraction: job ? calculateUploadedFractionForJob(job, inFlightBytes) : 0 };
}

export function useUploadJobLocalPreview(jobId: ID) {
  return useUploadQueueStore((state) => state.jobsById[jobId]?.media?.blurhash ?? null);
}

export function useCombinedUploadProgress(jobIds: readonly ID[]) {
  return useUploadQueueStore((state) => {
    const jobs = jobIds.map((jobId) => state.jobsById[jobId]).filter((job): job is UploadJob => !!job);
    const totalBytes = jobs.reduce((total, job) => total + job.sizeBytes, 0);
    const uploadedBytes = jobs.reduce(
      (total, job) => total + calculateUploadedFractionForJob(job, state.inFlightBytesByJobId[job.jobId] ?? 0) * job.sizeBytes,
      0,
    );
    return totalBytes > 0 ? uploadedBytes / totalBytes : jobs.length > 0 ? 0 : 1;
  });
}
