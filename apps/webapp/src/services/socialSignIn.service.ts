import type { User } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export type SocialSignInProvider = "apple" | "google";

export async function signInWithSocialProvider(provider: SocialSignInProvider): Promise<User> {
  const result = await sendRequestToWebappServer<{ user: User }>("/auth/social", { method: "POST", body: { provider } });
  return result.user;
}
