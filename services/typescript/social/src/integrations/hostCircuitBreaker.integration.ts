import { BlockedUrlError } from "../utils/ssrfGuard.util.js";
import type { SafeFetcher } from "./safeHttpFetcher.integration.js";

export interface HostCircuitBreakerOptions {
  readonly failuresToOpen: number;
  readonly openMilliseconds: number;
  readonly maximumTrackedHosts: number;
  readonly now: () => number;
}

const defaultOptions: HostCircuitBreakerOptions = { failuresToOpen: 5, openMilliseconds: 60_000, maximumTrackedHosts: 10_000, now: Date.now };

function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function withHostCircuitBreaker(fetcher: SafeFetcher, overrides: Partial<HostCircuitBreakerOptions> = {}): SafeFetcher {
  const options = { ...defaultOptions, ...overrides };
  const hosts = new Map<string, { failures: number; openUntil: number }>();
  return async (rawUrl, fetchOptions) => {
    const host = hostOf(rawUrl);
    const entry = hosts.get(host);
    if (entry !== undefined && entry.openUntil > options.now()) throw new BlockedUrlError("host is temporarily unavailable");
    try {
      const result = await fetcher(rawUrl, fetchOptions);
      hosts.delete(host);
      return result;
    } catch (error) {
      const failures = (entry?.failures ?? 0) + 1;
      hosts.delete(host);
      while (hosts.size >= options.maximumTrackedHosts) hosts.delete(hosts.keys().next().value as string);
      hosts.set(host, { failures, openUntil: failures >= options.failuresToOpen ? options.now() + options.openMilliseconds : 0 });
      throw error;
    }
  };
}
