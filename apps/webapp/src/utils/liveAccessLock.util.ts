export interface LiveAccess {
  readonly allowed: boolean;
  readonly reason: string;
}

export interface LiveAccessLock {
  readonly title: string;
  readonly body: string;
  readonly action: "follow" | "subscribe" | null;
}

export function describeLiveAccessLock(access: LiveAccess | null | undefined): LiveAccessLock | null {
  if (!access || access.allowed) return null;
  if (access.reason === "followersOnly") return { title: "Follow to watch", body: "This live is only for the host's followers.", action: "follow" };
  if (access.reason === "subscribersOnly") return { title: "Subscribe to watch", body: "This live is only for the host's subscribers.", action: "subscribe" };
  if (access.reason === "banned") return { title: "You can't watch this live", body: "The host removed you from this live.", action: null };
  return { title: "This live isn't available", body: "You can't watch this live right now.", action: null };
}
