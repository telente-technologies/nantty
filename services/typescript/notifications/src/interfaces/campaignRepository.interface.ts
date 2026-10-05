import type { BatchProgress, Campaign, CampaignKind, NewCampaign, NoticeDraft } from "../types/campaign.type.js";

export interface CampaignRepository {
  create(campaign: NewCampaign): Promise<Campaign>;
  findById(id: string): Promise<Campaign | null>;
  list(kind: CampaignKind, limit: number): Promise<readonly Campaign[]>;
  findActiveForVersion(versionId: string): Promise<Campaign | null>;
  applyBatchProgress(id: string, expectedBatchesDone: number, progress: BatchProgress, completedAt: Date | null): Promise<boolean>;
}

export interface NoticeDraftRepository {
  find(versionId: string): Promise<NoticeDraft | null>;
  createIfAbsent(draft: Omit<NoticeDraft, "updatedAt" | "testSends" | "updatedByName">): Promise<NoticeDraft>;
  update(versionId: string, changes: { readonly subject: string; readonly summaryText: string; readonly whatChanged: readonly string[]; readonly reacceptNote: string | null; readonly updatedByName: string }): Promise<NoticeDraft | null>;
  refreshVersionFacts(versionId: string, facts: { readonly versionNumber: number; readonly effectiveAt: Date; readonly requiresReacceptance: boolean; readonly reacceptNote: string | null }): Promise<NoticeDraft | null>;
  appendTestSend(versionId: string, testSend: { readonly sentToEmail: string; readonly sentByName: string; readonly sentAt: string }): Promise<NoticeDraft | null>;
}
