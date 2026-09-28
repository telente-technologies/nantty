import { defineEvent } from "@zudojs/events";

export interface PasswordResetCompletedPayload {
  readonly userId: string;
}

export const PasswordResetCompletedEvent = defineEvent<"auth.passwordResetCompleted", PasswordResetCompletedPayload>(
  "auth.passwordResetCompleted",
);
