import { concatBytes, decodeBase64, encodeBase64, utf8Decode, utf8Encode } from "./bytes.util";
import { type ChatLinkPreview, sanitizeLinkPreview } from "./payload";
import { type RandomSource, aeadKeyLength, aeadNonceLength, openAead, sealAead } from "./primitives";

const linkPreviewAssociatedData = utf8Encode("zudomart-link-preview-v1");
export const maximumSealedLinkPreviewLength = 8_192;

export function sealLinkPreview(preview: ChatLinkPreview, random: RandomSource): { readonly key: string; readonly sealed: string } | null {
  const key = random(aeadKeyLength);
  const nonce = random(aeadNonceLength);
  const sealed = encodeBase64(concatBytes(nonce, sealAead(key, nonce, utf8Encode(JSON.stringify(preview)), linkPreviewAssociatedData)));
  return sealed.length > maximumSealedLinkPreviewLength ? null : { key: encodeBase64(key), sealed };
}

export function openLinkPreview(sealed: string, key: string): ChatLinkPreview | null {
  try {
    const bytes = decodeBase64(sealed);
    const plaintext = openAead(decodeBase64(key), bytes.slice(0, aeadNonceLength), bytes.slice(aeadNonceLength), linkPreviewAssociatedData);
    return sanitizeLinkPreview(JSON.parse(utf8Decode(plaintext)));
  } catch {
    return null;
  }
}
