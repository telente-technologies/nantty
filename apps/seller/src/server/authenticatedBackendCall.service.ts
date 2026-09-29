import type { NextRequest, NextResponse } from "next/server";

import { exchangeRefreshTokenForNewTokenPair } from "@/server/sellerAuthentication.service";
import { callSellerBackend, type BackendCall, type BackendResult } from "@/server/sellerApiTransport.service";
import { readApiTokensFromCookies, readSelectedLocationIdFromCookies, writeApiTokenCookies, type ApiTokenPair } from "@/server/sellerSession.service";

export interface AuthenticatedBackendOutcome {
  readonly result: BackendResult;
  readonly rotatedTokens: ApiTokenPair | null;
}

export async function callBackendAsSignedInSeller(request: NextRequest, call: Omit<BackendCall, "accessToken">): Promise<AuthenticatedBackendOutcome> {
  const tokens = readApiTokensFromCookies(request.cookies);
  const locationId = call.locationId ?? readSelectedLocationIdFromCookies(request.cookies);
  let result = await callSellerBackend({ ...call, locationId, accessToken: tokens.accessToken });
  if (result.status !== 401 || !tokens.refreshToken) return { result, rotatedTokens: null };
  const rotatedTokens = await exchangeRefreshTokenForNewTokenPair(tokens.refreshToken);
  if (!rotatedTokens) return { result, rotatedTokens: null };
  result = await callSellerBackend({ ...call, locationId, accessToken: rotatedTokens.accessToken });
  return { result, rotatedTokens };
}

export function applyRotatedTokensToResponse(response: NextResponse, outcome: AuthenticatedBackendOutcome): void {
  if (outcome.rotatedTokens) writeApiTokenCookies(response, outcome.rotatedTokens);
}
