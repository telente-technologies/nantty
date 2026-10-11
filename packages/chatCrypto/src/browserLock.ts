import type { CrossContextLock } from "./chatCryptoClient";

interface LockManagerLike {
  request<T>(name: string, options: { readonly mode: "exclusive" }, callback: () => Promise<T>): Promise<T>;
}

export function createWebLocksMutex(name: string): CrossContextLock | undefined {
  const locks = (globalThis as { readonly navigator?: { readonly locks?: LockManagerLike } }).navigator?.locks;
  if (locks === undefined || typeof locks.request !== "function") return undefined;
  return (task) => locks.request(name, { mode: "exclusive" }, task);
}
