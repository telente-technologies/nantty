import { notFoundError, unauthorizedError } from "../../../errors/notifications.error.js";
import type { NoticeDraftRepository } from "../../../interfaces/campaignRepository.interface.js";
import type { LegalVersionSource } from "../../../interfaces/legalVersionSource.interface.js";
import type { NoticeDraft } from "../../../types/campaign.type.js";
import { buildNoticeDraftFields } from "./noticeDraftFields.service.js";

export class NoticeDraftProvisionerService {
  public constructor(private readonly drafts: NoticeDraftRepository, private readonly versions: LegalVersionSource | null, private readonly webBaseUrl: string) {}

  public async ensure(versionId: string, staffAuthorization: string | undefined): Promise<NoticeDraft> {
    const existing = await this.drafts.find(versionId);
    if (existing !== null) return existing;
    if (this.versions === null) throw notFoundError("Notice draft not found.");
    if (staffAuthorization === undefined || staffAuthorization === "") throw unauthorizedError();
    const version = await this.versions.findVersion(versionId, staffAuthorization);
    if (version === null) throw notFoundError("Legal version not found.");
    return this.drafts.createIfAbsent(buildNoticeDraftFields({
      versionId, documentKey: version.documentKey, documentTitle: version.documentKey, versionNumber: version.versionNumber,
      summaryText: version.changeSummary.trim() === "" ? "We have updated this document." : version.changeSummary, whatChanged: [], effectiveAt: version.effectiveAt,
      requiresReacceptance: version.isMaterialChange,
    }, this.webBaseUrl));
  }
}
