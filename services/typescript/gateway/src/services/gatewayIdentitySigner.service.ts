import { createHmac } from "node:crypto";

export const identitySignatureHeaderName = "x-zudomart-identity-signature";
export const signedIdentityHeaderNames = ["x-zudomart-account-id", "x-zudomart-session-id", "x-zudomart-age-bracket", "x-zudomart-viewer"] as const;

export interface IdentitySigningInput {
  readonly method: string;
  readonly path: string;
  readonly requestId: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly issuedAtSeconds: number;
}

export function buildIdentitySigningPayload(input: IdentitySigningInput): string {
  const fields = ["v1", String(input.issuedAtSeconds), input.method.toUpperCase(), input.path, input.requestId, ...signedIdentityHeaderNames.map((name) => input.headers[name] ?? "")];
  if (fields.some((field) => /[\r\n]/.test(field))) throw new Error("identity signing fields must not contain line breaks");
  return fields.join("\n");
}

export function signGatewayIdentity(secret: string, input: IdentitySigningInput): string {
  const digest = createHmac("sha256", secret).update(buildIdentitySigningPayload(input)).digest("hex");
  return `t=${input.issuedAtSeconds},v1=${digest}`;
}
