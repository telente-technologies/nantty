import type { PostNotificationScope, PostNotificationSubscriberSource } from "../interfaces/postNotificationSubscribers.interface.js";

export class SocialHttpPostNotificationSubscribers implements PostNotificationSubscriberSource {
  public constructor(private readonly baseUrl: string, private readonly internalToken: string) {}

  public async listPage(authorId: string, scope: PostNotificationScope, cursor: string | null, limit: number) {
    const query = new URLSearchParams({ scope, limit: String(limit), ...(cursor === null ? {} : { cursor }) });
    const response = await fetch(new URL(`/api/v1/internal/post-notification-subscribers/${encodeURIComponent(authorId)}?${query}`, this.baseUrl), { headers: { "x-internal-token": this.internalToken }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Post notification subscribers responded ${response.status}.`);
    const body = (await response.json()) as { data?: { userId: string }[]; nextCursor?: string | null };
    return { data: body.data ?? [], nextCursor: body.nextCursor ?? null };
  }
}
