import { defineEvent } from "@zudojs/events";

export interface MediaUploadedPayload {
  readonly mediaId: string;
  readonly ownerId: string;
  readonly purpose: string;
}

export const MediaUploadedEvent = defineEvent<"media.mediaUploaded", MediaUploadedPayload>("media.mediaUploaded");
