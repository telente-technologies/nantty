import { ApiError } from "@/errors/api.error";

import { authMocks } from "./auth.mock";
import { cartMocks } from "./cart.mock";
import { chatsMocks } from "./chats.mock";
import { clipsMocks } from "./clips.mock";
import { feedMocks } from "./feed.mock";
import { liveMocks } from "./live.mock";
import { localeMocks } from "./locale.mock";
import { notificationsMocks } from "./notifications.mock";
import { ordersMocks } from "./orders.mock";
import { postsMocks } from "./posts.mock";
import { productsMocks } from "./products.mock";
import type { MockRoute } from "./registry.mock";
import { sellerMocks } from "./seller.mock";
import { settingsMocks } from "./settings.mock";
import { storiesMocks } from "./stories.mock";
import { usersMocks } from "./users.mock";
import { walletMocks } from "./wallet.mock";

const routes: MockRoute[] = [
  ...localeMocks,
  ...authMocks,
  ...usersMocks,
  ...feedMocks,
  ...postsMocks,
  ...productsMocks,
  ...cartMocks,
  ...ordersMocks,
  ...chatsMocks,
  ...clipsMocks,
  ...notificationsMocks,
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
