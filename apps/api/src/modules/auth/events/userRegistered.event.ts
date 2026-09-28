import { defineEvent } from "@zudojs/events";

export interface UserRegisteredPayload {
  readonly userId: string;
  readonly username: string;
  readonly method: "password" | "google" | "apple";
}

export const UserRegisteredEvent = defineEvent<"auth.userRegistered", UserRegisteredPayload>("auth.userRegistered");
