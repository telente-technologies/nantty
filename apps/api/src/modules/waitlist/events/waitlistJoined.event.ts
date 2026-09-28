import { defineEvent } from "@zudojs/events";

export interface WaitlistJoinedPayload {
  readonly email: string;
  readonly role: "buyer" | "seller";
}

export const WaitlistJoinedEvent = defineEvent<"waitlist.joined", WaitlistJoinedPayload>("waitlist.joined");
