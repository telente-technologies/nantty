import type { ReportTargetResolver } from "../interfaces/reportTargetResolver.interface.js";

interface ReportTargetPreview {
  readonly ownerId?: unknown;
}

interface InternalSource {
  readonly baseUrl: string;
  readonly internalToken: string;
}

export function createHttpReportTargetResolver(
  sources: { readonly commerce?: InternalSource; readonly live?: InternalSource },
  fetcher: typeof fetch = fetch,
  timeoutMs = 3000,
): ReportTargetResolver {
  return {
    async resolveOwner(targetType, targetId) {
      const source = targetType === "live" || targetType === "space" ? sources.live : sources.commerce;
      if (source === undefined || source.internalToken === "") throw new Error(`Report target source unavailable: ${targetType}`);
      const url = new URL(`/api/v1/internal/moderation/targets/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`, source.baseUrl);
      let response: Response;
      try {
        response = await fetcher(url, { headers: { "x-internal-token": source.internalToken }, signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        throw new Error(`Report target lookup failed: ${targetType}`, { cause: error });
      }
      if (response.status === 404 || response.status === 410) return null;
      if (!response.ok) throw new Error(`Report target lookup failed: ${targetType} (${response.status})`);
      const preview = (await response.json()) as ReportTargetPreview;
      if (typeof preview.ownerId !== "string" || preview.ownerId.length === 0) throw new Error(`Report target owner missing: ${targetType}`);
      return preview.ownerId;
    },
  };
}
