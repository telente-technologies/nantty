import { defineEvent } from "@zudojs/events";

export interface UserLoggedInPayload {
  readonly userId: string;
  readonly sessionId: string;
  readonly method: "password" | "google" | "apple" | "one_time_code";
}

export const UserLoggedInEvent = defineEvent<"auth.user-logged-in", UserLoggedInPayload>("auth.user-logged-in");
