import { randomBytes } from "node:crypto";

import { buildHardenedCookieOptions, sessionCookieNames, sessionLifetimesInSeconds } from "@/config/sessionCookies.config";
import { signPayloadIntoCookieValue, verifySignedCookieValueAndReadPayload } from "@/server/signedCookie.service";
import type { SignedInAdmin } from "@/types/admin.type";

export interface CookieReader {
  get(name: string): { readonly value: string } | undefined;
}

export interface CookieWriter {
  set(name: string, value: string, options: ReturnType<typeof buildHardenedCookieOptions>): unknown;
}

export interface SessionEnvelope {
  readonly sessionId: string;
  readonly startedAtEpochSeconds: number;
}

export interface CachedSessionView {
  readonly sessionId: string;
  readonly admin: SignedInAdmin;
  readonly lastActivityAtEpochSeconds: number;
  readonly verifiedAtEpochSeconds: number;
}

export interface PendingMfaChallenge {
  readonly mfaToken: string;
  readonly email: string;
  readonly enrollmentRequired: boolean;
  readonly passkeyAvailable: boolean;
  readonly nextPath: string;
}

export interface StepUpGrant {
  readonly sessionId: string;
  readonly stepUpToken: string;
}

export interface ApiTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

const purposes = { session: "admin-session", view: "admin-session-view", mfa: "admin-pending-mfa", stepUp: "admin-step-up" } as const;

export function nowInEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function createNewSessionId(): string {
  return randomBytes(24).toString("base64url");
}

export function readSessionEnvelopeFromCookies(cookies: CookieReader): SessionEnvelope | null {
  const envelope = verifySignedCookieValueAndReadPayload<SessionEnvelope>(cookies.get(sessionCookieNames.session)?.value, purposes.session);
  if (!envelope) return null;
  if (nowInEpochSeconds() - envelope.startedAtEpochSeconds > sessionLifetimesInSeconds.absoluteSession) return null;
  return envelope;
}

export function readCachedSessionViewFromCookies(cookies: CookieReader): CachedSessionView | null {
  const envelope = readSessionEnvelopeFromCookies(cookies);
  if (!envelope) return null;
  const view = verifySignedCookieValueAndReadPayload<CachedSessionView>(cookies.get(sessionCookieNames.sessionView)?.value, purposes.view);
  if (!view || view.sessionId !== envelope.sessionId) return null;
  if (nowInEpochSeconds() - view.lastActivityAtEpochSeconds > sessionLifetimesInSeconds.idle) return null;
  return view;
}

export function isCachedSessionViewStale(view: CachedSessionView): boolean {
  return nowInEpochSeconds() - view.verifiedAtEpochSeconds > sessionLifetimesInSeconds.sessionViewFreshness;
}

export function readApiTokensFromCookies(cookies: CookieReader): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: cookies.get(sessionCookieNames.accessToken)?.value ?? null,
    refreshToken: cookies.get(sessionCookieNames.refreshToken)?.value ?? null,
  };
}

export function readPendingMfaChallengeFromCookies(cookies: CookieReader): PendingMfaChallenge | null {
  return verifySignedCookieValueAndReadPayload<PendingMfaChallenge>(cookies.get(sessionCookieNames.pendingMfa)?.value, purposes.mfa);
}

export function readStepUpTokenForSession(cookies: CookieReader, sessionId: string): string | null {
  const grant = verifySignedCookieValueAndReadPayload<StepUpGrant>(cookies.get(sessionCookieNames.stepUp)?.value, purposes.stepUp);
  return grant && grant.sessionId === sessionId ? grant.stepUpToken : null;
}

function remainingAbsoluteSessionSeconds(envelope: SessionEnvelope): number {
  return Math.max(0, sessionLifetimesInSeconds.absoluteSession - (nowInEpochSeconds() - envelope.startedAtEpochSeconds));
}

export function writeSessionEnvelopeCookie(cookies: CookieWriter, envelope: SessionEnvelope): void {
  const lifetime = remainingAbsoluteSessionSeconds(envelope);
  cookies.set(sessionCookieNames.session, signPayloadIntoCookieValue(envelope, purposes.session, lifetime), buildHardenedCookieOptions(lifetime));
}

export function writeCachedSessionViewCookie(cookies: CookieWriter, view: CachedSessionView): void {
  const lifetime = sessionLifetimesInSeconds.idle;
  cookies.set(sessionCookieNames.sessionView, signPayloadIntoCookieValue(view, purposes.view, lifetime), buildHardenedCookieOptions(lifetime));
}

export function writeApiTokenCookies(cookies: CookieWriter, tokens: ApiTokenPair): void {
  cookies.set(sessionCookieNames.accessToken, tokens.accessToken, buildHardenedCookieOptions(Math.min(tokens.expiresIn, sessionLifetimesInSeconds.accessToken)));
  cookies.set(sessionCookieNames.refreshToken, tokens.refreshToken, buildHardenedCookieOptions(sessionLifetimesInSeconds.refreshToken));
}

export function writePendingMfaChallengeCookie(cookies: CookieWriter, challenge: PendingMfaChallenge): void {
  const lifetime = sessionLifetimesInSeconds.pendingMfa;
  cookies.set(sessionCookieNames.pendingMfa, signPayloadIntoCookieValue(challenge, purposes.mfa, lifetime), buildHardenedCookieOptions(lifetime));
}

export function writeStepUpGrantCookie(cookies: CookieWriter, grant: StepUpGrant, lifetimeInSeconds: number): void {
  const lifetime = Math.min(lifetimeInSeconds, sessionLifetimesInSeconds.stepUp);
  cookies.set(sessionCookieNames.stepUp, signPayloadIntoCookieValue(grant, purposes.stepUp, lifetime), buildHardenedCookieOptions(lifetime));
}

export function refreshActivityOnSessionView(cookies: CookieWriter, view: CachedSessionView): void {
  writeCachedSessionViewCookie(cookies, { ...view, lastActivityAtEpochSeconds: nowInEpochSeconds() });
}

export function clearCookieByName(cookies: CookieWriter, cookieName: string): void {
  cookies.set(cookieName, "", buildHardenedCookieOptions(0));
}

export function clearEverySessionCookie(cookies: CookieWriter): void {
  for (const cookieName of Object.values(Object.getOwnPropertyDescriptors(sessionCookieNames)).map((descriptor) => descriptor.get?.() as string)) {
    clearCookieByName(cookies, cookieName);
  }
}

