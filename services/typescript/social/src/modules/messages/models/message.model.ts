import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";

export type MessageKindName = "text" | "voice" | "image" | "video" | "system" | "shared" | "location" | "liveLocation" | "document" | "poll" | "control";

export interface MessageAttachedMedia {
  readonly id: string;
  readonly type: "voice" | "image" | "video";
  readonly url: string | null;
  readonly durationSeconds?: number;
}

export interface EncryptedDocumentView {
  readonly url: string | null;
}

export interface SharedContentReference {
  readonly kind: "post" | "clip" | "story" | "product" | "live" | "store" | "profile" | "order";
  readonly id: string;
}

export interface SharedContentCard {
  readonly reference: SharedContentReference;
  readonly availability: "available" | "private" | "unavailable" | "not_in_region";
  readonly title: string | null;
  readonly subtitle: string | null;
  readonly imageUrl: string | null;
  readonly isLive: boolean;
  readonly followsAuthor: boolean | null;
  readonly priceLabel?: string | null;
  readonly stock?: number | null;
  readonly viewerCount?: number | null;
  readonly profileUserId: string | null;
}

export interface MessageView {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: "";
  readonly createdAt: string;
  readonly kind: MessageKindName;
  readonly sender?: UserSummary;
  readonly media: MessageAttachedMedia | null;
  readonly expiresAt: string | null;
  readonly mediaExpiresAt: string | null;
  readonly linkPreview: string | null;
  readonly document: EncryptedDocumentView | null;
  readonly readAt: string | null;
  readonly moderationHidden: boolean;
  readonly encryption: { readonly deviceId: string; readonly ciphertext: string | null; readonly protocol: string } | null;
  readonly mentions: readonly MentionEntity[];
  readonly clientMessageId: string | null;
}
