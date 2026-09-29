import { ApiError } from "@/errors/api.error";

import { adEventsMocks } from "./adEvents.mock";
import { authMocks } from "./auth.mock";
import { banksMocks } from "./banks.mock";
import { boostsMocks } from "./boosts.mock";
import { cartMocks } from "./cart.mock";
import { chatsMocks } from "./chats.mock";
import { groupsMocks } from "./groups.mock";
import { clipsMocks } from "./clips.mock";
import { coinsMocks } from "./coins.mock";
import { commentsMocks } from "./comments.mock";
import { creatorProgramMocks } from "./creatorProgram.mock";
import { creatorsMocks } from "./creators.mock";
import { creatorSubscriptionsMocks } from "./creatorSubscriptions.mock";
import { disputesMocks } from "./disputes.mock";
import { feedMocks } from "./feed.mock";
import { giftsMocks } from "./gifts.mock";
import { liveMocks } from "./live.mock";
import { localeMocks } from "./locale.mock";
import { mediaMocks } from "./media.mock";
import { notificationsMocks } from "./notifications.mock";
import { ordersMocks } from "./orders.mock";
import { postsMocks } from "./posts.mock";
import { productsMocks } from "./products.mock";
import { rewardsMocks } from "./rewards.mock";
import type { MockRoute } from "./registry.mock";
import { sellerMocks } from "./seller.mock";
import { settingsMocks } from "./settings.mock";
import { storiesMocks } from "./stories.mock";
import { supportMocks } from "./support.mock";
import { usernameMocks } from "./username.mock";
import { usersMocks } from "./users.mock";
import { verificationMocks } from "./verification.mock";
import { walletMocks } from "./wallet.mock";
import { reportsMocks } from "./reports.mock";

const routes: MockRoute[] = [
  ...localeMocks,
  ...usernameMocks,
  ...authMocks,
  ...usersMocks,
  ...feedMocks,
  ...postsMocks,
  ...productsMocks,
  ...cartMocks,
  ...ordersMocks,
  ...disputesMocks,
  ...banksMocks,
  ...creatorSubscriptionsMocks,
  ...creatorProgramMocks,
  ...rewardsMocks,
  ...verificationMocks,
  ...boostsMocks,
  ...supportMocks,
  ...groupsMocks,
  ...chatsMocks,
  ...clipsMocks,
  ...commentsMocks,
  ...mediaMocks,
  ...adEventsMocks,
  ...reportsMocks,
  ...coinsMocks,
  ...notificationsMocks,
  ...creatorsMocks,
  ...giftsMocks,
  ...liveMocks,
  ...storiesMocks,
  ...settingsMocks,
  ...walletMocks,
  ...sellerMocks,
];

const matchMockPathAndExtractParams = (pattern: string, path: string): Record<string, string> | null => {
  const a = pattern.split("/");
  const b = path.split("/");
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(":")) params[a[i]!.slice(1)] = decodeURIComponent(b[i]!);
    else if (a[i] !== b[i]) return null;
  }
  return params;
};

export async function resolveMockApiRequest<T>(method: string, url: string, body: unknown): Promise<T> {
  const [path = "", search = ""] = url.split("?");
  await new Promise((resolve) => setTimeout(resolve, 250));
  for (const r of routes) {
    if (r.method !== method) continue;
    const params = matchMockPathAndExtractParams(r.path, path);
    if (params) return r.handler({ params, query: new URLSearchParams(search), body }) as T;
  }
  throw new ApiError(404, `No mock for ${method} ${path}`);
}
