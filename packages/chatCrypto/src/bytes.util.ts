export type Bytes = Uint8Array;

const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64Lookup = new Map([...base64Alphabet].map((character, index) => [character, index]));

export function concatBytes(...parts: readonly Bytes[]): Bytes {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function encodeBase64(bytes: Bytes): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] as number;
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    output += base64Alphabet[(triple >> 18) & 63];
    output += base64Alphabet[(triple >> 12) & 63];
    output += b === undefined ? "=" : base64Alphabet[(triple >> 6) & 63];
    output += c === undefined ? "=" : base64Alphabet[triple & 63];
  }
  return output;
}

export function decodeBase64(text: string): Bytes {
  if (text.length % 4 !== 0) throw new TypeError("Invalid base64 length.");
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const output = new Uint8Array((text.length / 4) * 3 - padding);
  let written = 0;
  for (let index = 0; index < text.length; index += 4) {
    let triple = 0;
    for (let offset = 0; offset < 4; offset++) {
      const character = text[index + offset] as string;
      const isPadding = character === "=" && index + offset >= text.length - padding;
      const value = isPadding ? 0 : base64Lookup.get(character);
      if (value === undefined) throw new TypeError("Invalid base64 character.");
      triple = (triple << 6) | value;
    }
    for (const shift of [16, 8, 0]) {
      if (written < output.length) output[written++] = (triple >> shift) & 255;
    }
  }
  return output;
}

export const utf8Encode = (text: string): Bytes => new TextEncoder().encode(text);
export const utf8Decode = (bytes: Bytes): string => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

export function writeUint32(value: number): Bytes {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError("Value is not a uint32.");
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}

export function readUint32(bytes: Bytes, offset: number): number {
  if (offset + 4 > bytes.length) throw new RangeError("Truncated input.");
  return (((bytes[offset] as number) << 24) >>> 0) + ((bytes[offset + 1] as number) << 16) + ((bytes[offset + 2] as number) << 8) + (bytes[offset + 3] as number);
}

export function bytesEqual(left: Bytes, right: Bytes): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= (left[index] as number) ^ (right[index] as number);
  return difference === 0;
}

export class ByteReader {
  private offset = 0;

  public constructor(private readonly bytes: Bytes) {}

  public take(length: number): Bytes {
    if (this.offset + length > this.bytes.length) throw new RangeError("Truncated input.");
    const slice = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  public uint8(): number {
    return this.take(1)[0] as number;
  }

  public uint32(): number {
    const value = readUint32(this.bytes, this.offset);
    this.offset += 4;
    return value;
  }

  public rest(): Bytes {
    return this.take(this.bytes.length - this.offset);
  }
}
