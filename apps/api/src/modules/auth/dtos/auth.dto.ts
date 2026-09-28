import { schema } from "@zudojs/schema";

import type { IssuedTokens, SessionRecord } from "../models/auth.model.js";

export const AuthTokensSchema = schema.object({
  accessToken: schema.string(),
  refreshToken: schema.string(),
  expiresIn: schema.number(),
  tokenType: schema.literal("Bearer"),
});

export const SessionSchema = schema.object({
  id: schema.string().uuid(),
  userAgent: schema.nullable(schema.string()),
  ip: schema.nullable(schema.string()),
  createdAt: schema.string(),
  lastUsedAt: schema.string(),
  current: schema.boolean(),
});

export interface AuthTokensDto {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: "Bearer";
}

export interface SessionDto {
  readonly id: string;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly current: boolean;
}

export function convertIssuedTokensToDto(tokens: IssuedTokens): AuthTokensDto {
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn, tokenType: tokens.tokenType };
}

export function convertSessionToDto(session: SessionRecord, currentSessionId: string): SessionDto {
  return {
    id: session.id,
    userAgent: session.userAgent,
    ip: session.ip,
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt.toISOString(),
    current: session.id === currentSessionId,
  };
}
