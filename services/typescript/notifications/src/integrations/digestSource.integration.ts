import type { DigestEntry, DigestKind, DigestSource } from "../interfaces/digestSource.interface.js";

export class SocialHttpDigestSource implements DigestSource {
  public constructor(private readonly baseUrl: string, private readonly internalToken: string) {}

  public async listPage(kind: DigestKind, cursor: string | null, limit: number) {
    const query = new URLSearchParams({ limit: String(limit), ...(cursor === null ? {} : { cursor }) });
    const response = await fetch(new URL(`/api/v1/internal/digests/${kind}?${query}`, this.baseUrl), { headers: { "x-internal-token": this.internalToken }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Digest source responded ${response.status}.`);
    const body = (await response.json()) as { data?: DigestEntry[]; nextCursor?: string | null };
    return { data: body.data ?? [], nextCursor: body.nextCursor ?? null };
  }
}
