import type { NextRequest, NextResponse } from "next/server";

import { buildHardenedCookieOptions } from "@/config/sessionCookies.config";
import { shouldUseSecureHostPrefixedCookies } from "@/config/sellerEnvironment.config";
import { signPayloadIntoCookieValue, verifySignedCookieValueAndReadPayload } from "@/server/signedCookie.service";

const resetTokenPurpose = "password-reset";
const resetTokenLifetimeInSeconds = 10 * 60;

function readPasswordResetCookieName(): string {
  return shouldUseSecureHostPrefixedCookies() ? "__Host-zd_reset" : "zd_reset";
}

export function writePasswordResetTokenCookie(response: NextResponse, otpToken: string): void {
  response.cookies.set(readPasswordResetCookieName(), signPayloadIntoCookieValue(otpToken, resetTokenPurpose, resetTokenLifetimeInSeconds), buildHardenedCookieOptions(resetTokenLifetimeInSeconds));
}

export function readPasswordResetTokenFromCookie(request: NextRequest): string | null {
  return verifySignedCookieValueAndReadPayload<string>(request.cookies.get(readPasswordResetCookieName())?.value, resetTokenPurpose);
}

export function clearPasswordResetTokenCookie(response: NextResponse): void {
  response.cookies.set(readPasswordResetCookieName(), "", buildHardenedCookieOptions(0));
}

export function describeNewPasswordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 128) return "Use 128 characters or fewer.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Mix letters and numbers.";
  return null;
}

export function normaliseResetEmailAddress(rawDestination: unknown): string | null {
  if (typeof rawDestination !== "string") return null;
  const trimmed = rawDestination.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}
