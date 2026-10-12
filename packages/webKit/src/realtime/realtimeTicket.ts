import type { TicketRequest, TicketResult } from "./realtimeConnection";

export interface RealtimeTicketFetchOptions {
  readonly endpoint: string;
  readonly readCsrfToken: () => string | null;
  readonly fetchImplementation?: typeof fetch;
}

function readRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 600) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.min(Math.max(0, date - Date.now()), 600_000);
}

export function createRealtimeTicketFetcher(options: RealtimeTicketFetchOptions): (request: TicketRequest) => Promise<TicketResult> {
  return async ({ fresh }) => {
    const csrfToken = options.readCsrfToken();
    if (!csrfToken) return { kind: "ended" };
    let response: Response;
    try {
      response = await (options.fetchImplementation ?? fetch)(options.endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ fresh }),
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      return { kind: "retry" };
    }
    if (response.status === 401) return { kind: "ended" };
    if (response.status === 404 || response.status === 403) return { kind: "unavailable" };
    if (response.status === 429 || response.status === 503) return { kind: "retry", retryAfterMs: readRetryAfterMs(response.headers.get("retry-after")) };
    if (!response.ok) return { kind: "retry" };
    const ticket = (await response.json().catch(() => null)) as { readonly url?: unknown; readonly realtimeToken?: unknown } | null;
    if (typeof ticket?.url !== "string" || typeof ticket.realtimeToken !== "string" || !/^wss?:\/\//.test(ticket.url)) return { kind: "retry" };
    return { kind: "ticket", ticket: { url: ticket.url, realtimeToken: ticket.realtimeToken } };
  };
}
