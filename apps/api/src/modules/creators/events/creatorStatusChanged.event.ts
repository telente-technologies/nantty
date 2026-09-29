import { defineEvent } from "@zudojs/events";

export interface CreatorStatusChangedPayload {
  readonly userId: string;
  readonly status: "approved" | "rejected" | "suspended";
  readonly actorId: string;
}

export const CreatorStatusChangedEvent = defineEvent<"creators.creatorStatusChanged", CreatorStatusChangedPayload>("creators.creatorStatusChanged");
