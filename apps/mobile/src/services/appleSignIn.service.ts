import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

import { SocialSignInCancelledError, SocialSignInFailedError } from "@/errors/socialSignIn.error";
import { generateRandomSignInNonce, hashSignInNonceWithSha256, readNonceClaimFromIdentityToken } from "@/utils/signInNonce.util";

export interface AppleFullName {
  readonly givenName: string | null;
  readonly familyName: string | null;
}

export interface AppleIdentityTokenWithNonce {
  readonly identityToken: string;
  readonly nonce: string;
  readonly fullName: AppleFullName | null;
}

export async function checkIfAppleSignInIsAvailableOnThisDevice(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

const isAppleSignInCancellation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "ERR_REQUEST_CANCELED";

const keepAppleFullNameOnlyWhenProvided = (fullName: AppleAuthentication.AppleAuthenticationFullName | null): AppleFullName | null => {
  if (!fullName?.givenName && !fullName?.familyName) return null;
  return { givenName: fullName.givenName ?? null, familyName: fullName.familyName ?? null };
};

export async function requestAppleIdentityTokenWithNonce(): Promise<AppleIdentityTokenWithNonce> {
  const nonce = generateRandomSignInNonce();
  const hashedNonce = await hashSignInNonceWithSha256(nonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (isAppleSignInCancellation(error)) throw new SocialSignInCancelledError("apple");
    throw new SocialSignInFailedError("apple", error instanceof Error ? error.message : "unknown error");
  }
  if (!credential.identityToken) throw new SocialSignInFailedError("apple", "Apple didn't return an identity token.");
  if (readNonceClaimFromIdentityToken(credential.identityToken) !== hashedNonce) {
    throw new SocialSignInFailedError("apple", "the sign-in response didn't match this request.");
  }
  return { identityToken: credential.identityToken, nonce, fullName: keepAppleFullNameOnlyWhenProvided(credential.fullName) };
}
