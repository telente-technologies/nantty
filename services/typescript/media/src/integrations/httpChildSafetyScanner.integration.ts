import type { ChildSafetyScanResult, ChildSafetyScanner } from "../interfaces/childSafetyScanner.interface.js";

const childSafetyScanPath = "/api/v1/internal/moderation/child-safety/scan";

export function createHttpChildSafetyScanner(options: { readonly baseUrl: string; readonly internalToken: string; readonly timeoutMs: number; readonly fetchFn?: typeof fetch }): ChildSafetyScanner {
  const fetchFn = options.fetchFn ?? fetch;
  return {
    async scanMedia(input): Promise<ChildSafetyScanResult> {
      const response = await fetchFn(`${options.baseUrl.replace(/\/$/, "")}${childSafetyScanPath}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.internalToken === "" ? {} : { "x-internal-token": options.internalToken }),
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`child-safety scan answered ${response.status}`);
      }
      const body = (await response.json()) as { matched?: unknown; quarantined?: unknown; provider?: unknown };
      if (typeof body.matched !== "boolean" || typeof body.quarantined !== "boolean") {
        throw new Error("invalid child-safety scan response");
      }
      return {
        matched: body.matched,
        quarantined: body.quarantined,
        ...(typeof body.provider === "string" ? { provider: body.provider } : {}),
      };
    },
  };
}
