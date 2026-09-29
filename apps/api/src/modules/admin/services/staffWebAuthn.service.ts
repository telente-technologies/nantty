import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

import type { AppSettings } from "../../../configs/settings.config.js";
import type { StaffAccountRecord, WebAuthnCredentialRecord } from "../models/platformStaff.model.js";

export interface VerifiedPasskeyRegistration {
  readonly credentialId: string;
  readonly publicKey: string;
  readonly signCount: number;
  readonly transports: readonly string[];
}

export interface WebAuthnCeremonies {
  createRegistrationOptions(account: StaffAccountRecord, existing: readonly WebAuthnCredentialRecord[]): Promise<{ readonly options: unknown; readonly challenge: string }>;
  verifyRegistration(response: unknown, expectedChallenge: string): Promise<VerifiedPasskeyRegistration | undefined>;
  createAuthenticationOptions(credentials: readonly WebAuthnCredentialRecord[]): Promise<{ readonly options: unknown; readonly challenge: string }>;
  verifyAuthentication(credential: WebAuthnCredentialRecord, response: unknown, expectedChallenge: string): Promise<{ readonly newSignCount: number } | undefined>;
  findCredentialIdInResponse(response: unknown): string | undefined;
}

function readCredentialId(response: unknown): string | undefined {
  if (typeof response !== "object" || response === null) return undefined;
  const id = (response as { readonly id?: unknown }).id;
  return typeof id === "string" && id.length > 0 && id.length <= 1024 ? id : undefined;
}

export class SimpleWebAuthnCeremonies implements WebAuthnCeremonies {
  public constructor(private readonly settings: AppSettings["platformAdmin"]["webAuthn"]) {}

  public async createRegistrationOptions(account: StaffAccountRecord, existing: readonly WebAuthnCredentialRecord[]) {
    const options = await generateRegistrationOptions({
      rpName: this.settings.relyingPartyName,
      rpID: this.settings.relyingPartyId,
      userName: account.email,
      userDisplayName: account.name,
      userID: new TextEncoder().encode(account.id),
      attestationType: "none",
      excludeCredentials: existing.map((credential) => ({ id: credential.credentialId, transports: [...credential.transports] })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    });
    return { options, challenge: options.challenge };
  }

  public async verifyRegistration(response: unknown, expectedChallenge: string): Promise<VerifiedPasskeyRegistration | undefined> {
    try {
      const verification = await verifyRegistrationResponse({
        response: response as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: [...this.settings.origins],
        expectedRPID: this.settings.relyingPartyId,
        requireUserVerification: true,
      });
      if (!verification.verified) return undefined;
      const { credential } = verification.registrationInfo;
      return {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        signCount: credential.counter,
        transports: credential.transports ?? [],
      };
    } catch {
      return undefined;
    }
  }

  public async createAuthenticationOptions(credentials: readonly WebAuthnCredentialRecord[]) {
    const options = await generateAuthenticationOptions({
      rpID: this.settings.relyingPartyId,
      userVerification: "required",
      allowCredentials: credentials.map((credential) => ({ id: credential.credentialId, transports: [...credential.transports] })),
    });
    return { options, challenge: options.challenge };
  }

  public async verifyAuthentication(credential: WebAuthnCredentialRecord, response: unknown, expectedChallenge: string): Promise<{ readonly newSignCount: number } | undefined> {
    try {
      const verification = await verifyAuthenticationResponse({
        response: response as AuthenticationResponseJSON,
        expectedChallenge,
        expectedOrigin: [...this.settings.origins],
        expectedRPID: this.settings.relyingPartyId,
        requireUserVerification: true,
        credential: {
          id: credential.credentialId,
          publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")),
          counter: credential.signCount,
          transports: [...credential.transports] as never,
        },
      });
      return verification.verified ? { newSignCount: verification.authenticationInfo.newCounter } : undefined;
    } catch {
      return undefined;
    }
  }

  public findCredentialIdInResponse(response: unknown): string | undefined {
    return readCredentialId(response);
  }
}
