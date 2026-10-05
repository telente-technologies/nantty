import type { NoticeDraftRepository } from "../../../../interfaces/campaignRepository.interface.js";
import type { NoticeDraft } from "../../../../types/campaign.type.js";
import type { DomainEventEnvelope } from "../../../../types/domainEvent.type.js";
import { EventDataReader } from "../../../../utils/eventDataReader.util.js";
import { buildNoticeDraftFields, defaultReacceptNote } from "../../services/noticeDraftFields.service.js";
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
    const fields = buildNoticeDraftFields(details, this.webBaseUrl);
    const existing = await this.drafts.find(details.versionId);
    const draft = existing === null ? await this.drafts.createIfAbsent(fields) : await this.refreshFacts(existing, fields);
    if (this.autoSend) await this.queueNotice.execute({ versionId: draft.versionId, reason: "Queued automatically on publish", actor: { id: "system", name: details.publishedByName } });
  }

  private async refreshFacts(existing: NoticeDraft, fields: ReturnType<typeof buildNoticeDraftFields>): Promise<NoticeDraft> {
    const sameFacts = existing.effectiveAt.getTime() === fields.effectiveAt.getTime() && existing.versionNumber === fields.versionNumber && existing.requiresReacceptance === fields.requiresReacceptance;
    if (sameFacts) return existing;
    const reacceptNote = fields.requiresReacceptance ? (existing.reacceptNote ?? defaultReacceptNote) : null;
    return (await this.drafts.refreshVersionFacts(existing.versionId, { versionNumber: fields.versionNumber, effectiveAt: fields.effectiveAt, requiresReacceptance: fields.requiresReacceptance, reacceptNote })) ?? existing;
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
