import { defineEvent } from "@zudojs/events";

export interface ProfileUpdatedPayload {
  readonly userId: string;
}

export const ProfileUpdatedEvent = defineEvent<"users.profileUpdated", ProfileUpdatedPayload>("users.profileUpdated");

export interface AccountDeactivatedPayload {
  readonly userId: string;
}

export const AccountDeactivatedEvent = defineEvent<"users.accountDeactivated", AccountDeactivatedPayload>("users.accountDeactivated");
