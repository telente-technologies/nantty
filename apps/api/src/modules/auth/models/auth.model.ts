import type { UserRecord } from "../../users/models/users.model.js";

export type OtpPurpose = "signup" | "login" | "reset_password";
export type VerifiedDestinationPurpose = `${OtpPurpose}_verified`;
export type StoredCodePurpose = OtpPurpose | VerifiedDestinationPurpose;
export type SocialProvider = "google" | "apple";

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly revokedReason: string | null;
}

export interface NewSessionInput {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly expiresAt: Date;
}

export interface OtpRecord {
  readonly id: string;
  readonly target: string;
  readonly purpose: StoredCodePurpose;
  readonly codeHash: string;
  readonly attempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}

export interface ClientDetails {
  readonly userAgent: string | null;
  readonly ip: string | null;
}

export interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: "Bearer";
  readonly sessionId: string;
}

export interface VerifiedSocialIdentity {
  readonly provider: SocialProvider;
  readonly subject: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly name: string | null;
}

export interface AuthenticationResult {
  readonly user: UserRecord;
  readonly tokens: IssuedTokens;
  readonly isNewUser: boolean;
}
