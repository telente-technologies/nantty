import type { NextResponse } from "next/server";

import { buildHardenedCookieOptions, sessionCookieNames } from "@/config/sessionCookies.config";
import type { CookieReader } from "@/server/sellerSession.service";
import { signPayloadIntoCookieValue, verifySignedCookieValueAndReadPayload } from "@/server/signedCookie.service";

const ticketPurpose = "seller-realtime-ticket";
const minimumRemainingSeconds = 30;

interface CachedTicket {
  readonly sessionId: string;
  readonly realtimeToken: string;
}

function secondsUntilExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp - Math.floor(Date.now() / 1000) : 0;
  } catch {
    return 0;
  }
}

export function readReusableRealtimeTicket(cookies: CookieReader, sessionId: string): string | null {
  const cached = verifySignedCookieValueAndReadPayload<CachedTicket>(cookies.get(sessionCookieNames.realtimeTicket)?.value, ticketPurpose);
  if (!cached || cached.sessionId !== sessionId) return null;
  return secondsUntilExpiry(cached.realtimeToken) > minimumRemainingSeconds ? cached.realtimeToken : null;
}

export function rememberRealtimeTicket(response: NextResponse, sessionId: string, realtimeToken: string): void {
  const lifetime = secondsUntilExpiry(realtimeToken) - minimumRemainingSeconds;
  if (lifetime <= 0) return;
  response.cookies.set(sessionCookieNames.realtimeTicket, signPayloadIntoCookieValue<CachedTicket>({ sessionId, realtimeToken }, ticketPurpose, lifetime), buildHardenedCookieOptions(lifetime));
}
