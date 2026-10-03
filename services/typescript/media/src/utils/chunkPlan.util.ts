import { largePartBytesOptions, recommendedParallelParts, singlePutLimitBytes, standardMultipartLimitBytes, standardPartBytes, targetMaximumLargeParts } from "../constants/media.constant.js";

export interface UploadPlan {
  readonly mode: "single" | "multipart";
  readonly partSizeBytes: number;
  readonly partCount: number;
  readonly recommendedParallelism: number;
}

export function planUpload(sizeBytes: number): UploadPlan {
  if (sizeBytes < singlePutLimitBytes) return { mode: "single", partSizeBytes: sizeBytes, partCount: 1, recommendedParallelism: 1 };
  if (sizeBytes <= standardMultipartLimitBytes) return { mode: "multipart", partSizeBytes: standardPartBytes, partCount: Math.ceil(sizeBytes / standardPartBytes), recommendedParallelism: recommendedParallelParts };
  const partSizeBytes = largePartBytesOptions.find((candidate) => Math.ceil(sizeBytes / candidate) <= targetMaximumLargeParts) ?? Math.max(...largePartBytesOptions, Math.ceil(sizeBytes / 10_000));
  return { mode: "multipart", partSizeBytes, partCount: Math.ceil(sizeBytes / partSizeBytes), recommendedParallelism: recommendedParallelParts };
}

export function expectedChunkBytes(index: number, sizeBytes: number, chunkSizeBytes: number, totalChunks: number): number {
  return index === totalChunks - 1 ? sizeBytes - chunkSizeBytes * (totalChunks - 1) : chunkSizeBytes;
}
