import { PoisonEventError } from "../../../errors/social.error.js";
import type { Handler } from "../../../types/handlerContext.type.js";
import type { ApplyContentVisibilityCommand, ModerationVisibilityValue } from "../commands/applyContentVisibility/applyContentVisibility.command.js";
import type { ApplyProcessedMediaCommand, ProcessedMediaVariant } from "../commands/applyProcessedMedia/applyProcessedMedia.command.js";
import type { ApplyCopyrightAudioRemedyCommand } from "../commands/applyCopyrightAudioRemedy/applyCopyrightAudioRemedy.command.js";
import type { ApplySensitiveLabelsCommand } from "../commands/applySensitiveLabels/applySensitiveLabels.command.js";
import { advisoryLabelsAboveThreshold, normaliseSensitiveLabels, type AdvisoryLabelScore } from "../../posts/services/sensitiveContent.service.js";

const visibilities: readonly ModerationVisibilityValue[] = ["visible", "restricted", "hidden", "removed"];

interface Envelope {
  readonly type: string;
  readonly occurredAt?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

function parseEnvelope(body: string): Envelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new PoisonEventError("social event is not JSON");
  }
  const candidate = parsed as Partial<Envelope> | null;
  if (candidate === null || typeof candidate !== "object" || typeof candidate.type !== "string" || typeof candidate.data !== "object" || candidate.data === null) {
    throw new PoisonEventError("social event is not an envelope");
  }
  return candidate as Envelope;
}

const optionalNumber = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const optionalString = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

function readVariants(value: unknown): ProcessedMediaVariant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: Record<string, unknown>) =>
    typeof item?.["key"] === "string" && typeof item["format"] === "string" ? [{ key: item["key"], format: item["format"], width: optionalNumber(item["width"]) ?? 0, height: optionalNumber(item["height"]) ?? 0 }] : []);
}

export interface ContentEventHandlers {
  readonly applyContentVisibility: Handler<ApplyContentVisibilityCommand, boolean>;
  readonly applyProcessedMedia: Handler<ApplyProcessedMediaCommand, unknown>;
  readonly applySensitiveLabels?: Handler<ApplySensitiveLabelsCommand, boolean>;
  readonly applyCopyrightAudioRemedy?: Handler<ApplyCopyrightAudioRemedyCommand, unknown>;
  readonly blockReportedUser?: Handler<{ readonly reporterId: string; readonly reportedUserId: string }, unknown>;
  readonly revokeStoreInboxAccess?: Handler<{ readonly storeId: string; readonly accountId: string; readonly occurredAt: Date }, unknown>;
}

const storeTeamChangeEvents = new Set(["store.staff_removed", "store.staff_updated"]);

function copyrightAudioModeFor(envelope: Envelope): "mute" | "restore" | undefined {
  if (envelope.type === "copyrightClaim.audioMuteOrdered") return "mute";
  if (envelope.type === "copyrightClaim.restored" && envelope.data["remedy"] === "audio_muted") return "restore";
  return undefined;
}

function readAdvisoryScores(value: unknown): AdvisoryLabelScore[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: Record<string, unknown>) => {
    const [label] = normaliseSensitiveLabels([item?.["label"]]);
    const score = optionalNumber(item?.["score"]);
    return label === undefined || score === undefined ? [] : [{ label, score }];
  });
}

export function createContentEventRouter(handlers: ContentEventHandlers) {
  return async (body: string): Promise<void> => {
    const envelope = parseEnvelope(body);
    const occurredAt = envelope.occurredAt === undefined || Number.isNaN(Date.parse(envelope.occurredAt)) ? new Date() : new Date(envelope.occurredAt);
    const data = envelope.data;
    if (envelope.type === "content.visibilityChanged") {
      const visibility = data["visibility"] as ModerationVisibilityValue;
      if (typeof data["targetType"] !== "string" || typeof data["targetId"] !== "string" || !visibilities.includes(visibility)) throw new PoisonEventError("content.visibilityChanged data is malformed");
      await handlers.applyContentVisibility({ targetType: data["targetType"], targetId: data["targetId"], visibility, occurredAt });
      if (Array.isArray(data["labels"]) && handlers.applySensitiveLabels !== undefined) {
        await handlers.applySensitiveLabels({ targetType: data["targetType"], targetId: data["targetId"], source: "moderation", labels: normaliseSensitiveLabels(data["labels"]), occurredAt });
      }
      return;
    }
    if (envelope.type === "content.sensitivityAdvised") {
      if (typeof data["targetType"] !== "string" || typeof data["targetId"] !== "string") throw new PoisonEventError("content.sensitivityAdvised data is malformed");
      await handlers.applySensitiveLabels?.({ targetType: data["targetType"], targetId: data["targetId"], source: "advisory", labels: advisoryLabelsAboveThreshold(readAdvisoryScores(data["scores"])), occurredAt });
      return;
    }
    if (storeTeamChangeEvents.has(envelope.type)) {
      const storeId = optionalString(data["storeId"]);
      const accountId = optionalString(data["accountId"]);
      if (storeId === undefined || accountId === undefined) throw new PoisonEventError(`${envelope.type} has no store or account`);
      await handlers.revokeStoreInboxAccess?.({ storeId, accountId, occurredAt });
      return;
    }
    if (envelope.type === "chatReport.received") {
      if (data["blockReportedUser"] !== true) return;
      const reporterId = optionalString(data["reporterId"]);
      const reportedUserId = optionalString(data["reportedUserId"]);
      if (reporterId === undefined || reportedUserId === undefined) throw new PoisonEventError("chatReport.received asks for a block without both users");
      await handlers.blockReportedUser?.({ reporterId, reportedUserId });
      return;
    }
    const copyrightAudioMode = copyrightAudioModeFor(envelope);
    if (copyrightAudioMode !== undefined) {
      const claimId = optionalString(data["claimId"]);
      if (claimId === undefined || typeof data["targetType"] !== "string" || typeof data["targetId"] !== "string") throw new PoisonEventError(`${envelope.type} data is malformed`);
      await handlers.applyCopyrightAudioRemedy?.({ claimId, targetType: data["targetType"], targetId: data["targetId"], mode: copyrightAudioMode, occurredAt });
      return;
    }
    if (envelope.type !== "media.processed" && envelope.type !== "media.rejected") return;
    const mediaId = optionalString(data["mediaId"]);
    if (mediaId === undefined) throw new PoisonEventError(`${envelope.type} has no mediaId`);
    await handlers.applyProcessedMedia({
      mediaId,
      outcome: envelope.type === "media.processed" ? "ready" : "failed",
      kind: optionalString(data["kind"]),
      width: optionalNumber(data["width"]),
      height: optionalNumber(data["height"]),
      durationSeconds: optionalNumber(data["durationSeconds"]),
      posterKey: optionalString(data["posterKey"]),
      hlsKey: optionalString(data["hlsKey"]),
      variants: readVariants(data["variants"]),
      occurredAt,
    });
  };
}
