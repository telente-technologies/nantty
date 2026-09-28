import { defineEvent } from "@zudojs/events";

export interface UserRegisteredPayload {
  readonly userId: string;
  readonly username: string;
  readonly method: "password" | "google" | "apple";
}

export const UserRegisteredEvent = defineEvent<"auth.user-registered", UserRegisteredPayload>("auth.user-registered");
