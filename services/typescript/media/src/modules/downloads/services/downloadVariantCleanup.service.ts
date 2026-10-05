import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { downloadVariantRepository } from "../repositories/downloadVariant.repository.js";

export async function discardDownloadVariants(context: HandlerContext, assetId: string): Promise<number> {
  const rows = await downloadVariantRepository.findByAsset(context.database.client, assetId);
  for (const row of rows) if (row.bucket !== null && row.key !== null) await context.storage.deleteObject(row.bucket, row.key).catch(() => undefined);
  if (rows.length > 0) await downloadVariantRepository.deleteByAsset(context.database.client, assetId);
  return rows.length;
}
