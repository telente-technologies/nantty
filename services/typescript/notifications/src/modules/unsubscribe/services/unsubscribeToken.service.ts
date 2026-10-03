import { createHmac, timingSafeEqual } from "node:crypto";

export class UnsubscribeTokenService {
  public constructor(private readonly signingSecret: string, private readonly publicApiBaseUrl: string) {}

  public sign(accountId: string): string {
    const payload = Buffer.from(JSON.stringify({ a: accountId, p: "marketing" })).toString("base64url");
    return `${payload}.${this.computeSignature(payload)}`;
  }

  public verify(token: string): string | null {
    const [payload, signature, ...rest] = token.split(".");
    if (payload === undefined || signature === undefined || rest.length > 0) return null;
    const expected = Buffer.from(this.computeSignature(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { a?: unknown; p?: unknown };
      return parsed.p === "marketing" && typeof parsed.a === "string" && parsed.a !== "" ? parsed.a : null;
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
