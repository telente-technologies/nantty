import { sendRequestToDashboardServer } from "@/services/clientApi.service";

async function deleteCachedDashboardPages(): Promise<void> {
  if (typeof caches === "undefined") return;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.filter((cacheName) => cacheName.startsWith("zudomart-dashboard")).map((cacheName) => caches.delete(cacheName)));
}

export async function signOutOfDashboardAndClearCachedPages(): Promise<void> {
  await import("@/services/chatCrypto/storeChatEngine").then(({ storeChatEngine }) => storeChatEngine.shutdown()).catch(() => undefined);
  await import("@/services/chatCrypto/storeChatCrypto.service").then(({ storeChatCrypto }) => storeChatCrypto.signOut()).catch(() => undefined);
  await sendRequestToDashboardServer("/bff/auth/logout", { method: "POST" }).catch(() => undefined);
  await deleteCachedDashboardPages().catch(() => undefined);
  window.location.assign("/login");
}
