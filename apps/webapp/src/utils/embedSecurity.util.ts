import { createHash } from "node:crypto";

export const embedResizeMessageType = "nantty:embed:resize";
export const embedMinimumHeight = 64;
export const embedMaximumHeight = 2400;

export function hashInlineScriptForCsp(source: string): string {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;
}

export function buildEmbedContentSecurityPolicy(inlineScriptSource: string): string {
  return [
    "default-src 'none'",
    `script-src ${hashInlineScriptForCsp(inlineScriptSource)}`,
    "style-src 'unsafe-inline'",
    "img-src https: data:",
    "font-src 'none'",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors *",
  ].join("; ");
}

export function buildEmbedResponseHeaders(inlineScriptSource: string, cacheSeconds: number): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": buildEmbedContentSecurityPolicy(inlineScriptSource),
    "Cache-Control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds * 2}, stale-while-revalidate=${cacheSeconds}` : "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "X-Robots-Tag": "noindex",
  };
}

export interface EmbedResizeMessage {
  readonly type: typeof embedResizeMessageType;
  readonly frame: string;
  readonly height: number;
}

export function readEmbedResizeHeight(data: unknown, expectedFrame: string, origin: string, allowedOrigin: string): number | null {
  if (origin !== "null" && origin !== allowedOrigin) return null;
  if (typeof data !== "object" || data === null) return null;
  const message = data as Partial<EmbedResizeMessage>;
  if (message.type !== embedResizeMessageType || message.frame !== expectedFrame || typeof message.height !== "number" || !Number.isFinite(message.height)) return null;
  return Math.min(Math.max(Math.round(message.height), embedMinimumHeight), embedMaximumHeight);
}

export class EmbedRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  public constructor(private readonly limitPerMinute: number, private readonly maxClients = 50_000, private readonly now: () => number = () => Date.now()) {}

  public allow(clientKey: string): boolean {
    const moment = this.now();
    const current = this.windows.get(clientKey);
    if (current === undefined || current.resetAt <= moment) {
      if (this.windows.size >= this.maxClients) this.windows.clear();
      this.windows.set(clientKey, { count: 1, resetAt: moment + 60_000 });
      return true;
    }
    current.count += 1;
    return current.count <= this.limitPerMinute;
  }
}

export class EmbedResponseCache {
  private readonly entries = new Map<string, { body: string; status: number; expiresAt: number }>();

  public constructor(private readonly timeToLiveMs: number, private readonly maxEntries = 5_000, private readonly now: () => number = () => Date.now()) {}

  public read(key: string): { readonly body: string; readonly status: number } | null {
    const entry = this.entries.get(key);
    if (entry === undefined || entry.expiresAt <= this.now()) return null;
    return entry;
  }

  public write(key: string, body: string, status: number): void {
    if (this.entries.size >= this.maxEntries) this.entries.clear();
    this.entries.set(key, { body, status, expiresAt: this.now() + this.timeToLiveMs });
  }
}

export function readEmbedClientKey(forwardedFor: string | null, realIp: string | null): string {
  const first = (forwardedFor ?? "").split(",")[0]?.trim();
  return first !== undefined && first !== "" ? first : (realIp ?? "unknown");
}
