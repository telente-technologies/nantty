import type { NoticeDraftRepository } from "../../../../interfaces/campaignRepository.interface.js";
import type { DomainEventEnvelope } from "../../../../types/domainEvent.type.js";
import { EventDataReader } from "../../../../utils/eventDataReader.util.js";
import { policyDocumentDefinitions } from "../../../../constants/policyDocuments.constant.js";
import type { QueueLegalNoticeHandler } from "../../../bulkCampaigns/commands/queueLegalNotice/queueLegalNotice.handler.js";
import type { PolicyPublishedPort } from "../../../eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import type { HandleDomainEventCommand } from "../../../eventIngestion/commands/handleDomainEvent/handleDomainEvent.command.js";

export class CreateDraftFromPublishedPolicyHandler implements PolicyPublishedPort {
  public constructor(
    private readonly drafts: NoticeDraftRepository,
    private readonly webBaseUrl: string,
    private readonly autoSend: boolean,
    private readonly queueNotice: Pick<QueueLegalNoticeHandler, "execute">,
  ) {}

  public async handlePolicyPublished(command: HandleDomainEventCommand): Promise<void> {
    const details = this.readDetails(command.event);
    const definition = policyDocumentDefinitions[details.documentKey] ?? { title: details.documentTitle, publicPath: `/legal/${details.documentKey}` };
    const draft = await this.drafts.createIfAbsent({
      versionId: details.versionId, documentKey: details.documentKey, documentTitle: definition.title, versionNumber: details.versionNumber,
      subject: `We've updated our ${definition.title}`, summaryText: details.summaryText, whatChanged: details.whatChanged, effectiveAt: new Date(details.effectiveAt),
      reacceptNote: details.requiresReacceptance ? "This is a material change. Please review and accept it in the app before the effective date to keep using Zudomart." : null,
      requiresReacceptance: details.requiresReacceptance, documentUrl: `${this.webBaseUrl}${definition.publicPath}`,
    });
    if (this.autoSend) await this.queueNotice.execute({ versionId: draft.versionId, reason: "Queued automatically on publish", actor: { id: "system", name: details.publishedByName } });
  }

  private readDetails(event: DomainEventEnvelope): PolicyDetails {
    const data = new EventDataReader(event.data);
    const kind = data.text("kind");
    const documentKey = data.optionalText("documentKey") ?? (kind === "privacy_policy" ? "privacy" : kind === "cookie_policy" ? "cookies" : kind);
    const versionId = data.optionalText("versionId") ?? `${kind}:${data.text("version")}`;
    return {
      versionId, documentKey, documentTitle: data.text("documentTitle", documentKey), versionNumber: Number.parseInt(data.text("version", "1"), 10) || 1,
      summaryText: data.text("changeSummary", "We have updated this document."), whatChanged: data.textList("whatChanged"), effectiveAt: data.text("effectiveAt"),
      requiresReacceptance: data.bool("isMaterialChange", documentKey === "terms" || documentKey === "privacy"), publishedByName: data.text("publishedBy"),
    };
  }
}

interface PolicyDetails {
  readonly versionId: string;
  readonly documentKey: string;
  readonly documentTitle: string;
  readonly versionNumber: number;
  readonly summaryText: string;
  readonly whatChanged: readonly string[];
  readonly effectiveAt: string;
  readonly requiresReacceptance: boolean;
  readonly publishedByName: string;
}
