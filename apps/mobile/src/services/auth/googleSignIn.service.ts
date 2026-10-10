import * as Application from "expo-application";
import * as AuthSession from "expo-auth-session";
import { Platform } from "react-native";

import { findGoogleClientIdForThisPlatform } from "@/config/socialSignIn.config";
import { SocialSignInCancelledError, SocialSignInFailedError, SocialSignInNotConfiguredError } from "@/errors/socialSignIn.error";
import { generateRandomSignInNonce, readNonceClaimFromIdentityToken } from "@/utils/signInNonce.util";

const googleDiscoveryDocument: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const GOOGLE_SIGN_IN_SCOPES = ["openid", "profile", "email"];

export interface GoogleIdTokenWithNonce {
  readonly idToken: string;
  readonly nonce: string;
}

export const isGoogleSignInConfiguredForThisPlatform = () => findGoogleClientIdForThisPlatform() !== null;

const buildGoogleRedirectUri = () => AuthSession.makeRedirectUri({ native: `${Application.applicationId}:/oauthredirect` });

const exchangeGoogleAuthorizationCodeForIdToken = async (request: AuthSession.AuthRequest, clientId: string, redirectUri: string, code: string) => {
  const tokens = await AuthSession.exchangeCodeAsync(
    { clientId, redirectUri, code, extraParams: { code_verifier: request.codeVerifier ?? "" } },
    googleDiscoveryDocument,
  );
  return tokens.idToken ?? null;
};

export async function requestGoogleIdTokenWithNonce(): Promise<GoogleIdTokenWithNonce> {
  const clientId = findGoogleClientIdForThisPlatform();
  if (!clientId) throw new SocialSignInNotConfiguredError("google");
  const isWebBrowserFlow = Platform.OS === "web";
  const nonce = generateRandomSignInNonce();
  const redirectUri = buildGoogleRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: GOOGLE_SIGN_IN_SCOPES,
    responseType: isWebBrowserFlow ? AuthSession.ResponseType.IdToken : AuthSession.ResponseType.Code,
    usePKCE: !isWebBrowserFlow,
    prompt: AuthSession.Prompt.SelectAccount,
    extraParams: { nonce },
  });
  const result = await request.promptAsync(googleDiscoveryDocument, { windowFeatures: { width: 515, height: 680 } });
  if (result.type === "cancel" || result.type === "dismiss") throw new SocialSignInCancelledError("google");
  if (result.type !== "success") throw new SocialSignInFailedError("google", result.type === "error" ? result.error?.message ?? "unknown error" : result.type);
  const idToken = isWebBrowserFlow
    ? result.params.id_token ?? null
    : await exchangeGoogleAuthorizationCodeForIdToken(request, clientId, redirectUri, result.params.code ?? "");
  if (!idToken) throw new SocialSignInFailedError("google", "Google didn't return an ID token.");
  if (readNonceClaimFromIdentityToken(idToken) !== nonce) throw new SocialSignInFailedError("google", "the sign-in response didn't match this request.");
  return { idToken, nonce };
}
