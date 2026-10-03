export interface ProcessBulkBatchCommand {
  readonly campaignId: string;
  readonly batchIndex: number;
  readonly cursor: string | null;
}
