import { randomBytes, timingSafeEqual } from "node:crypto";

import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { demoMockTotpCode, type MockAdminRecord } from "@/mocks/seed/demoAdmins.mock";

export const mockAccessTokenLifetimeInSeconds = 10 * 60;
const mockRefreshTokenLifetimeInMilliseconds = 12 * 60 * 60 * 1000;

export function createRandomMockToken(prefix: string, byteLength = 24): string {
  return `${prefix}_${randomBytes(byteLength).toString("base64url")}`;
}

export function areStringsEqualInConstantTime(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function isMockTotpCodeValid(code: string): boolean {
  return areStringsEqualInConstantTime(demoMockTotpCode, code);
}

export function createBase32Secret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  return Array.from(randomBytes(20), (byte) => alphabet[byte % 32]).join("");
}

export function presentSignedInAdmin(admin: MockAdminRecord) {
  return { id: admin.id, email: admin.email, name: admin.name, role: admin.role, permissions: admin.permissions };
}

export function issueMockTokenPairForSession(adminId: string, sessionId: string) {
  const database = readMockDatabase();
  const accessToken = createRandomMockToken("mock_at");
  const refreshToken = createRandomMockToken("mock_rt", 32);
  database.accessTokens.set(accessToken, { adminId, sessionId, expiresAtEpochMs: Date.now() + mockAccessTokenLifetimeInSeconds * 1000 });
  database.refreshTokens.set(refreshToken, { adminId, sessionId, expiresAtEpochMs: Date.now() + mockRefreshTokenLifetimeInMilliseconds, used: false });
  return { accessToken, refreshToken, expiresIn: mockAccessTokenLifetimeInSeconds, tokenType: "Bearer" as const };
}

export function startMockAdminSession(admin: MockAdminRecord, ipAddress: string, userAgent: string) {
  const database = readMockDatabase();
  const sessionId = createRandomMockToken("ses", 12);
  const now = new Date().toISOString();
  database.adminSessions.set(sessionId, { id: sessionId, adminId: admin.id, ipAddress, userAgent, startedAt: now, lastSeenAt: now, revoked: false });
  admin.lastLoginAt = now;
  return issueMockTokenPairForSession(admin.id, sessionId);
}

export function revokeMockAdminSession(sessionId: string): void {
  const database = readMockDatabase();
  const session = database.adminSessions.get(sessionId);
  if (session) session.revoked = true;
  for (const [token, record] of database.accessTokens) if (record.sessionId === sessionId) database.accessTokens.delete(token);
  for (const [token, record] of database.refreshTokens) if (record.sessionId === sessionId) database.refreshTokens.delete(token);
  for (const [token, record] of database.stepUpTokens) if (record.sessionId === sessionId) database.stepUpTokens.delete(token);
}

export function revokeEveryMockSessionForAdmin(adminId: string): void {
  for (const session of readMockDatabase().adminSessions.values()) if (session.adminId === adminId && !session.revoked) revokeMockAdminSession(session.id);
}

export function createRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
