import { defineEvent } from "@zudojs/events";

export interface PasswordResetCompletedPayload {
  readonly userId: string;
}

export const PasswordResetCompletedEvent = defineEvent<"auth.password-reset-completed", PasswordResetCompletedPayload>(
  "auth.password-reset-completed",
);
