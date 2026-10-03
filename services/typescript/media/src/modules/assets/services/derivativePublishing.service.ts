import type { ProcessedFile } from "../../../interfaces/mediaProcessors.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { derivativeKeyFor } from "../../../utils/objectKeys.util.js";

const immutableCacheControl = "public, max-age=31536000, immutable";

export function derivativeBucketFor(context: HandlerContext, isPrivate: boolean): string {
  return isPrivate ? context.config.storage.privateBucket : context.config.storage.publicBucket;
}

export async function uploadDerivatives(context: HandlerContext, mediaId: string, isPrivate: boolean, files: readonly ProcessedFile[]): Promise<void> {
  const bucket = derivativeBucketFor(context, isPrivate);
  const queue = [...files];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
      await context.storage.putObject(bucket, derivativeKeyFor(mediaId, isPrivate, file.name), file.source, {
        contentType: file.contentType,
        ...(isPrivate ? { encrypted: true } : { cacheControl: immutableCacheControl }),
      });
    }
  });
  await Promise.all(workers);
}
