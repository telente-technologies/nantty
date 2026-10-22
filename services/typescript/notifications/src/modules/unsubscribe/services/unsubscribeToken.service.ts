import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 90 * 24 * 60 * 60;

export class UnsubscribeTokenService {
  public constructor(
    private readonly signingSecret: string,
    private readonly publicApiBaseUrl: string,
    private readonly ttlSeconds = DEFAULT_TTL_SECONDS,
  ) {}

  public sign(accountId: string, issuedAt = new Date()): string {
    const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
    const payload = Buffer.from(JSON.stringify({ a: accountId, p: "marketing", iat: issuedAtSeconds, exp: issuedAtSeconds + this.ttlSeconds })).toString("base64url");
    return `${payload}.${this.computeSignature(payload)}`;
  }

  public verify(token: string): string | null {
    const [payload, signature, ...rest] = token.split(".");
    if (payload === undefined || signature === undefined || rest.length > 0) return null;
    const expected = Buffer.from(this.computeSignature(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { a?: unknown; p?: unknown; iat?: unknown; exp?: unknown };
      if (parsed.p !== "marketing" || typeof parsed.a !== "string" || parsed.a === "") return null;
      if (typeof parsed.iat !== "number" || typeof parsed.exp !== "number" || !Number.isInteger(parsed.iat) || !Number.isInteger(parsed.exp)) return null;
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (parsed.iat > nowSeconds + 60 || parsed.exp <= nowSeconds) return null;
      return parsed.a;
    } catch {
      return null;
    }
  }

  public buildUnsubscribeUrl(accountId: string): string {
    return `${this.publicApiBaseUrl.replace(/\/$/, "")}/api/v1/email/unsubscribe?token=${this.sign(accountId)}`;
  }

  private computeSignature(payload: string): string {
    return createHmac("sha256", this.signingSecret).update(payload).digest("base64url");
  }
}
