import { ApiError, forbiddenError } from "../errors/notifications.error.js";
import type { LegalVersionFacts, LegalVersionSource } from "../interfaces/legalVersionSource.interface.js";

export class IdentityLegalVersionSource implements LegalVersionSource {
  public constructor(private readonly baseUrl: string, private readonly timeoutMs = 5000) {}

  public async findVersion(versionId: string, staffAuthorization: string): Promise<LegalVersionFacts | null> {
    const response = await fetch(new URL(`/api/v1/admin/legal/versions/${encodeURIComponent(versionId)}`, this.baseUrl), {
      headers: { authorization: staffAuthorization, accept: "application/json" }, signal: AbortSignal.timeout(this.timeoutMs),
    }).catch(() => null);
    if (response === null) throw new ApiError(503, "LEGAL_VERSIONS_UNAVAILABLE", "Legal documents are temporarily unavailable. Try again shortly.");
    if (response.status === 404 || response.status === 400) return null;
    if (response.status === 401 || response.status === 403) throw forbiddenError();
    if (!response.ok) throw new ApiError(503, "LEGAL_VERSIONS_UNAVAILABLE", "Legal documents are temporarily unavailable. Try again shortly.");
    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body["id"] !== "string" || typeof body["documentKey"] !== "string" || typeof body["effectiveAt"] !== "string") return null;
    return {
      id: body["id"], documentKey: body["documentKey"], versionNumber: typeof body["versionNumber"] === "number" ? body["versionNumber"] : 1,
      changeSummary: typeof body["changeSummary"] === "string" ? body["changeSummary"] : "", effectiveAt: body["effectiveAt"], isMaterialChange: body["isMaterialChange"] === true,
    };
  }
}
