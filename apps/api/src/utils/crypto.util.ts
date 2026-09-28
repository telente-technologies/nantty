import { decryptEnvelope, encryptEnvelope, hmacSha256 } from "@zudojs/crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function derivePurposeSpecificKey(master: Uint8Array, purpose: string): Promise<Uint8Array> {
  return new Uint8Array(Buffer.from(await hmacSha256(purpose, master, "hex"), "hex"));
}

export class FieldCipher {
  public constructor(private readonly key: Uint8Array) {}

  public encryptText(plaintext: string): Promise<string> {
    return encryptEnvelope(encoder.encode(plaintext), this.key);
  }

  public async decryptText(envelope: string): Promise<string> {
    return decoder.decode(await decryptEnvelope(envelope, this.key));
  }
}

export function maskAllButLastCharacters(value: string, visible = 4): string {
  const tail = value.slice(-visible);
  return `${"*".repeat(Math.max(0, value.length - visible))}${tail}`;
}
