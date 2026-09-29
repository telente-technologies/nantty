import * as Crypto from "expo-crypto";

const NONCE_BYTE_LENGTH = 32;

export const generateRandomSignInNonce = () =>
  Array.from(Crypto.getRandomBytes(NONCE_BYTE_LENGTH), (byte) => byte.toString(16).padStart(2, "0")).join("");

export const hashSignInNonceWithSha256 = (rawNonce: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce, { encoding: Crypto.CryptoEncoding.HEX });

const decodeBase64UrlSegmentToText = (segment: string) => {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  const binary = atob(base64);
  const percentEncodedBytes = Array.from(binary, (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
  return decodeURIComponent(percentEncodedBytes);
};

export const readNonceClaimFromIdentityToken = (identityToken: string): string | null => {
  const payloadSegment = identityToken.split(".")[1];
  if (!payloadSegment) return null;
  try {
    const claims = JSON.parse(decodeBase64UrlSegmentToText(payloadSegment)) as { nonce?: unknown };
    return typeof claims.nonce === "string" ? claims.nonce : null;
  } catch {
    return null;
  }
};
