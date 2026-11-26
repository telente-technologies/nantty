import { createHash } from "node:crypto";

import { conflict } from "../../../errors/social.error.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import type { MessageRow } from "../repositories/message.repository.js";
import type { OutgoingMessageInput } from "./messageValidation.service.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function createMessagePayloadHash(message: OutgoingMessageInput, mentions: readonly MentionEntity[] | undefined): string {
  const payload = {
    kind: message.kind,
    encryption: message.encryption === undefined ? null : {
      deviceId: message.encryption.deviceId,
      ciphertext: message.encryption.ciphertext,
      protocol: message.encryption.protocol ?? "signal-v1",
    },
    media: message.media === undefined ? null : {
      mediaId: message.media.mediaId,
      durationSeconds: message.media.durationSeconds ?? null,
    },
    linkPreview: message.linkPreview ?? null,
    mentions: mentions ?? [],
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

export function assertMessageReplayMatches(
  existing: MessageRow,
  payloadHash: string,
  message: OutgoingMessageInput,
  mentions: readonly MentionEntity[] | undefined,
): void {
  if (existing.clientPayloadHash !== null) {
    if (existing.clientPayloadHash !== payloadHash) throw conflict("IDEMPOTENCY_KEY_REUSED", "This message ID was already used for a different message.");
    return;
  }

  const storedMentions = JSON.stringify(canonicalize(existing.mentions));
  const requestedMentions = JSON.stringify(canonicalize(mentions ?? []));
  const sameLegacyPayload = existing.kind === message.kind
    && existing.ciphertext === (message.encryption?.ciphertext ?? null)
    && existing.deviceId === (message.encryption?.deviceId ?? null)
    && existing.protocol === (message.encryption?.protocol ?? "signal-v1")
    && existing.mediaId === (message.media?.mediaId ?? null)
    && existing.mediaType === (["voice", "image", "video"].includes(message.kind) ? message.kind : null)
    && existing.linkPreviewEnvelope === (message.linkPreview ?? null)
    && storedMentions === requestedMentions;
  if (!sameLegacyPayload) throw conflict("IDEMPOTENCY_KEY_REUSED", "This message ID was already used for a different message.");
}
