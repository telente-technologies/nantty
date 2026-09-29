import { unprocessable } from "../../../errors/domain.error.js";

import type { WebAuthnCredentialRecord } from "../models/platformStaff.model.js";

const SECURITY_KEYS_UNAVAILABLE = "Security keys are not available yet. Use an authenticator app.";

export interface WebAuthnRegistrationOptions {
  readonly challenge: string;
  readonly relyingPartyId: string;
  readonly userId: string;
}

export interface WebAuthnVerifier {
  createRegistrationOptions(userId: string, existing: readonly WebAuthnCredentialRecord[]): Promise<WebAuthnRegistrationOptions>;
  verifyRegistrationResponse(userId: string, response: unknown): Promise<Omit<WebAuthnCredentialRecord, "id" | "userId" | "createdAt" | "lastUsedAt">>;
  verifyAuthenticationResponse(credential: WebAuthnCredentialRecord, response: unknown): Promise<{ readonly newSignCount: number }>;
}

export class UnavailableWebAuthnVerifier implements WebAuthnVerifier {
  public async createRegistrationOptions(): Promise<WebAuthnRegistrationOptions> {
    throw unprocessable(SECURITY_KEYS_UNAVAILABLE);
  }

  public async verifyRegistrationResponse(): Promise<never> {
    throw unprocessable(SECURITY_KEYS_UNAVAILABLE);
  }

  public async verifyAuthenticationResponse(): Promise<never> {
    throw unprocessable(SECURITY_KEYS_UNAVAILABLE);
  }
}
