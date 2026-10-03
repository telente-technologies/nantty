import { createSign } from "node:crypto";

const toCloudFrontBase64 = (value: Buffer) => value.toString("base64").replaceAll("+", "-").replaceAll("=", "_").replaceAll("/", "~");

export function signCloudFrontUrl(options: { readonly url: string; readonly keyPairId: string; readonly privateKeyPem: string; readonly expiresAt: Date }): string {
  const expires = Math.floor(options.expiresAt.getTime() / 1000);
  const policy = JSON.stringify({ Statement: [{ Resource: options.url, Condition: { DateLessThan: { "AWS:EpochTime": expires } } }] });
  const signature = createSign("RSA-SHA1").update(policy).sign(options.privateKeyPem);
  const separator = options.url.includes("?") ? "&" : "?";
  return `${options.url}${separator}Expires=${expires}&Signature=${toCloudFrontBase64(signature)}&Key-Pair-Id=${options.keyPairId}`;
}
