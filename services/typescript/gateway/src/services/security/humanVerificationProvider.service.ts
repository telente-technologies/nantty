export interface HumanVerificationResult {
  readonly success: boolean;
  readonly errorCodes: readonly string[];
  readonly hostname?: string;
}

export interface HumanVerificationProvider {
  readonly name: string;
  verifyChallengeToken(token: string, remoteIp: string | undefined, idempotencyKey: string): Promise<HumanVerificationResult>;
}

export class HumanVerificationUnavailableError extends Error {}

interface SiteVerifyReply {
  readonly success?: boolean;
  readonly "error-codes"?: readonly string[];
  readonly hostname?: string;
}

async function postSiteVerify(url: string, form: Record<string, string>, timeoutMs: number): Promise<SiteVerifyReply> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: new URLSearchParams(form), signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new HumanVerificationUnavailableError("verification provider unreachable");
  }
  if (response.status >= 500) throw new HumanVerificationUnavailableError(`verification provider answered ${response.status}`);
  return (await response.json()) as SiteVerifyReply;
}

function judge(reply: SiteVerifyReply, expectedHostnames: readonly string[]): HumanVerificationResult {
  const errorCodes = (reply["error-codes"] ?? []).filter((code) => typeof code === "string").slice(0, 5);
  if (reply.success !== true) return { success: false, errorCodes: errorCodes.length > 0 ? errorCodes : ["verification-failed"] };
  if (expectedHostnames.length > 0 && (reply.hostname === undefined || !expectedHostnames.includes(reply.hostname))) return { success: false, errorCodes: ["hostname-mismatch"] };
  return { success: true, errorCodes: [], ...(reply.hostname === undefined ? {} : { hostname: reply.hostname }) };
}

export class TurnstileVerificationProvider implements HumanVerificationProvider {
  public readonly name = "turnstile";

  public constructor(private readonly secretKey: string, private readonly expectedHostnames: readonly string[] = [], private readonly timeoutMs = 5_000, private readonly verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify") {}

  public async verifyChallengeToken(token: string, remoteIp: string | undefined, idempotencyKey: string): Promise<HumanVerificationResult> {
    const form: Record<string, string> = { secret: this.secretKey, response: token, idempotency_key: idempotencyKey };
    if (remoteIp !== undefined && remoteIp !== "") form["remoteip"] = remoteIp;
    return judge(await postSiteVerify(this.verifyUrl, form, this.timeoutMs), this.expectedHostnames);
  }
}

export class HCaptchaVerificationProvider implements HumanVerificationProvider {
  public readonly name = "hcaptcha";

  public constructor(private readonly secretKey: string, private readonly siteKey: string, private readonly expectedHostnames: readonly string[] = [], private readonly timeoutMs = 5_000, private readonly verifyUrl = "https://api.hcaptcha.com/siteverify") {}

  public async verifyChallengeToken(token: string, remoteIp: string | undefined): Promise<HumanVerificationResult> {
    const form: Record<string, string> = { secret: this.secretKey, response: token, sitekey: this.siteKey };
    if (remoteIp !== undefined && remoteIp !== "") form["remoteip"] = remoteIp;
    return judge(await postSiteVerify(this.verifyUrl, form, this.timeoutMs), this.expectedHostnames);
  }
}
