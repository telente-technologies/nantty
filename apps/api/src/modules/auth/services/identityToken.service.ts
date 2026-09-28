import { createPublicKey, verify as verifySignature, type webcrypto } from "node:crypto";

import { UnauthorizedError } from "@zudojs/errors";

import type { Clock } from "../../../interfaces/clock.interface.js";
import type { SocialProvider, VerifiedSocialIdentity } from "../models/auth.model.js";

export interface IdentityTokenVerifier {
  verifyIdentityToken(provider: SocialProvider, idToken: string): Promise<VerifiedSocialIdentity>;
}

interface ProviderSettings {
  readonly keysUrl: string;
  readonly issuers: readonly string[];
  readonly audiences: readonly string[];
}

interface CachedKeys {
  readonly keys: readonly (webcrypto.JsonWebKey & { kid?: string })[];
  readonly fetchedAt: number;
}

const KEY_CACHE_MILLISECONDS = 60 * 60 * 1000;

function decodeTokenSegment(segment: string): Record<string, unknown> {
  const decoded: unknown = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  if (typeof decoded !== "object" || decoded === null) throw new UnauthorizedError("Invalid identity token.");
  return decoded as Record<string, unknown>;
}

export class JsonWebKeyIdentityTokenVerifier implements IdentityTokenVerifier {
  private readonly cachedKeys = new Map<SocialProvider, CachedKeys>();
  private readonly providers: Readonly<Record<SocialProvider, ProviderSettings>>;

  public constructor(googleClientIds: readonly string[], appleClientIds: readonly string[], private readonly clock: Clock) {
    this.providers = {
      google: {
        keysUrl: "https://www.googleapis.com/oauth2/v3/certs",
        issuers: ["accounts.google.com", "https://accounts.google.com"],
        audiences: googleClientIds,
      },
      apple: { keysUrl: "https://appleid.apple.com/auth/keys", issuers: ["https://appleid.apple.com"], audiences: appleClientIds },
    };
  }

  public async verifyIdentityToken(provider: SocialProvider, idToken: string): Promise<VerifiedSocialIdentity> {
    const settings = this.providers[provider];
    if (settings.audiences.length === 0) throw new UnauthorizedError(`${provider} sign-in is not configured.`);
    const [headerSegment, payloadSegment, signatureSegment] = idToken.split(".");
    if (headerSegment === undefined || payloadSegment === undefined || signatureSegment === undefined) {
      throw new UnauthorizedError("Invalid identity token.");
    }
    const header = decodeTokenSegment(headerSegment);
    const claims = decodeTokenSegment(payloadSegment);
    if (header["alg"] !== "RS256") throw new UnauthorizedError("Invalid identity token.");
    const key = await this.findSigningKey(provider, String(header["kid"]));
    const signatureIsValid = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${headerSegment}.${payloadSegment}`),
      createPublicKey({ key, format: "jwk" }),
      Buffer.from(signatureSegment, "base64url"),
    );
    this.assertClaimsAreValid(signatureIsValid, claims, settings);
    const email = typeof claims["email"] === "string" ? claims["email"].toLowerCase() : null;
    return {
      provider,
      subject: String(claims["sub"]),
      email,
      emailVerified: claims["email_verified"] === true || claims["email_verified"] === "true",
      name: typeof claims["name"] === "string" ? claims["name"] : null,
    };
  }

  private assertClaimsAreValid(signatureIsValid: boolean, claims: Record<string, unknown>, settings: ProviderSettings): void {
    const nowSeconds = Math.floor(this.clock.now().getTime() / 1000);
    const audience = claims["aud"];
    const audienceMatches = Array.isArray(audience)
      ? audience.some((entry) => settings.audiences.includes(String(entry)))
      : settings.audiences.includes(String(audience));
    const valid =
      signatureIsValid &&
      audienceMatches &&
      settings.issuers.includes(String(claims["iss"])) &&
      typeof claims["sub"] === "string" &&
      typeof claims["exp"] === "number" &&
      claims["exp"] > nowSeconds - 5;
    if (!valid) throw new UnauthorizedError("Invalid identity token.");
  }

  private async findSigningKey(provider: SocialProvider, keyId: string): Promise<webcrypto.JsonWebKey> {
    const cached = this.cachedKeys.get(provider);
    const fresh = cached !== undefined && Date.now() - cached.fetchedAt < KEY_CACHE_MILLISECONDS;
    const keys = fresh ? cached.keys : await this.downloadSigningKeys(provider);
    const key = keys.find((candidate) => candidate.kid === keyId);
    if (key === undefined) throw new UnauthorizedError("Invalid identity token.");
    return key;
  }

  private async downloadSigningKeys(provider: SocialProvider): Promise<CachedKeys["keys"]> {
    const response = await fetch(this.providers[provider].keysUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new UnauthorizedError("Could not verify the identity token right now.");
    const body = (await response.json()) as { keys?: CachedKeys["keys"] };
    const keys = body.keys ?? [];
    this.cachedKeys.set(provider, { keys, fetchedAt: Date.now() });
    return keys;
  }
}
