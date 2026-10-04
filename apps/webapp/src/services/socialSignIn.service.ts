import type { User } from "@/types";

import { showToast } from "@/components/ui/toast";

import { sendRequestToWebappServer } from "./clientApi.service";

export type SocialSignInProvider = "apple" | "google";

export async function signInWithSocialProvider(provider: SocialSignInProvider): Promise<User> {
  const result = await sendRequestToWebappServer<{ user: User; notice?: string | null }>("/auth/social", { method: "POST", body: { provider } });
  if (result.notice) showToast({ text: result.notice });
  return result.user;
}
