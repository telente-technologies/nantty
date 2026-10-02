import type { User } from "@/types";

import { sendRequestToStudioServer } from "./clientApi.service";

export type SocialSignInProvider = "apple" | "google";

export async function signInWithSocialProvider(provider: SocialSignInProvider): Promise<User> {
  const result = await sendRequestToStudioServer<{ user: User }>("/auth/social", { method: "POST", body: { provider } });
  return result.user;
}
