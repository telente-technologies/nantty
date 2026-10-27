import * as WebBrowser from "expo-web-browser";

import { webAppBaseUrl } from "@/config/webAppLinks.config";

export const HUMAN_VERIFICATION_RETURN_URL = "nantty://security-check";

let inFlight: Promise<boolean> | null = null;

export function readTokenFromSecurityCheckReturnUrl(url: string): string | null {
  if (!url.startsWith(HUMAN_VERIFICATION_RETURN_URL)) return null;
  const fragment = url.split("#")[1] ?? "";
  const token = new URLSearchParams(fragment).get("token");
  return token && token.length <= 2048 ? token : null;
}

async function openSecurityCheckAndSubmitToken(reason: string, submitToken: (token: string) => Promise<unknown>): Promise<boolean> {
  const challengeUrl = `${webAppBaseUrl}/security-check?reason=${encodeURIComponent(reason)}&return=${encodeURIComponent(HUMAN_VERIFICATION_RETURN_URL)}`;
  const result = await WebBrowser.openAuthSessionAsync(challengeUrl, HUMAN_VERIFICATION_RETURN_URL, { preferEphemeralSession: true });
  if (result.type !== "success") return false;
  const token = readTokenFromSecurityCheckReturnUrl(result.url);
  if (!token) return false;
  try {
    await submitToken(token);
    return true;
  } catch {
    return false;
  }
}

export function runHumanVerificationInAppBrowser(reason: string, submitToken: (token: string) => Promise<unknown>): Promise<boolean> {
  inFlight ??= openSecurityCheckAndSubmitToken(reason, submitToken).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
