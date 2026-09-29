function decodeBase64UrlToBuffer(base64UrlText: string): ArrayBuffer {
  const padded = base64UrlText.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64UrlText.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function encodeBufferToBase64Url(buffer: ArrayBuffer | null): string | null {
  if (!buffer) return null;
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface CredentialDescriptorJson {
  readonly type: "public-key";
  readonly id: string;
}

export interface PasskeyRequestOptionsJson {
  readonly challenge: string;
  readonly rpId?: string;
  readonly timeout?: number;
  readonly userVerification?: UserVerificationRequirement;
  readonly allowCredentials?: readonly CredentialDescriptorJson[];
}

export interface PasskeyCreationOptionsJson {
  readonly challenge: string;
  readonly rp: { readonly name: string; readonly id?: string };
  readonly user: { readonly id: string; readonly name: string; readonly displayName: string };
  readonly pubKeyCredParams: readonly { readonly type: "public-key"; readonly alg: number }[];
  readonly authenticatorSelection?: AuthenticatorSelectionCriteria;
  readonly excludeCredentials?: readonly CredentialDescriptorJson[];
  readonly timeout?: number;
  readonly attestation?: AttestationConveyancePreference;
}

export function isPasskeySupportedInThisBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && Boolean(navigator.credentials);
}

function convertDescriptors(descriptors: readonly CredentialDescriptorJson[] | undefined): PublicKeyCredentialDescriptor[] | undefined {
  return descriptors?.map((descriptor) => ({ type: descriptor.type, id: decodeBase64UrlToBuffer(descriptor.id) }));
}

export async function requestPasskeyAssertion(options: PasskeyRequestOptionsJson): Promise<Record<string, unknown>> {
  const credential = (await navigator.credentials.get({
    publicKey: { challenge: decodeBase64UrlToBuffer(options.challenge), rpId: options.rpId, timeout: options.timeout, userVerification: options.userVerification, allowCredentials: convertDescriptors(options.allowCredentials) },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No passkey was chosen.");
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: encodeBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: encodeBufferToBase64Url(response.clientDataJSON),
      authenticatorData: encodeBufferToBase64Url(response.authenticatorData),
      signature: encodeBufferToBase64Url(response.signature),
      userHandle: encodeBufferToBase64Url(response.userHandle),
    },
  };
}

export async function createPasskeyCredential(options: PasskeyCreationOptionsJson): Promise<Record<string, unknown>> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: decodeBase64UrlToBuffer(options.challenge),
      rp: options.rp,
      user: { id: decodeBase64UrlToBuffer(options.user.id), name: options.user.name, displayName: options.user.displayName },
      pubKeyCredParams: [...options.pubKeyCredParams],
      authenticatorSelection: options.authenticatorSelection,
      excludeCredentials: convertDescriptors(options.excludeCredentials),
      timeout: options.timeout,
      attestation: options.attestation,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey creation was cancelled.");
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: encodeBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: { clientDataJSON: encodeBufferToBase64Url(response.clientDataJSON), attestationObject: encodeBufferToBase64Url(response.attestationObject), transports: response.getTransports?.() ?? [] },
  };
}
