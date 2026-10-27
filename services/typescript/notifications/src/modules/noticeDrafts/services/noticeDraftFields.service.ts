import { policyDocumentDefinitions } from "../../../constants/policyDocuments.constant.js";
import type { NoticeDraft } from "../../../types/campaign.type.js";

export interface NoticeDraftSource {
  readonly versionId: string;
  readonly documentKey: string;
  readonly documentTitle: string;
  readonly versionNumber: number;
  readonly summaryText: string;
  readonly whatChanged: readonly string[];
  readonly effectiveAt: string;
  readonly requiresReacceptance: boolean;
}

export const defaultReacceptNote = "This is a material change. Please review and accept it in the app before the effective date to keep using Nantty.";

export function buildNoticeDraftFields(source: NoticeDraftSource, webBaseUrl: string): Omit<NoticeDraft, "updatedAt" | "testSends" | "updatedByName"> {
  const definition = policyDocumentDefinitions[source.documentKey] ?? { title: source.documentTitle, publicPath: `/legal/${source.documentKey}` };
  return {
    versionId: source.versionId, documentKey: source.documentKey, documentTitle: definition.title, versionNumber: source.versionNumber,
    subject: `We've updated our ${definition.title}`, summaryText: source.summaryText, whatChanged: source.whatChanged, effectiveAt: new Date(source.effectiveAt),
    reacceptNote: source.requiresReacceptance ? defaultReacceptNote : null, requiresReacceptance: source.requiresReacceptance, documentUrl: `${webBaseUrl}${definition.publicPath}`,
  };
}
