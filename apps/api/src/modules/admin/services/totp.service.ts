import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TIME_STEP_SECONDS = 30;
const CODE_DIGITS = 6;
const ACCEPTED_CLOCK_DRIFT_STEPS = 1;
const SECRET_BYTES = 20;

export function encodeBytesAsBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32ToBytes(encoded: string): Uint8Array {
  const cleaned = encoded.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error("The secret is not valid base32.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export function generateTotpSecretInBase32(): string {
  return encodeBytesAsBase32(new Uint8Array(randomBytes(SECRET_BYTES)));
}

export function calculateTotpTimeStep(at: Date): number {
  return Math.floor(at.getTime() / 1000 / TIME_STEP_SECONDS);
}

export function generateTotpCodeForTimeStep(secretBase32: string, timeStep: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));
  const digest = createHmac("sha1", decodeBase32ToBytes(secretBase32)).update(counter).digest();
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** CODE_DIGITS;
  return binary.toString().padStart(CODE_DIGITS, "0");
}

export function generateTotpCode(secretBase32: string, at: Date): string {
  return generateTotpCodeForTimeStep(secretBase32, calculateTotpTimeStep(at));
}

export function findMatchingTotpTimeStep(secretBase32: string, code: string, at: Date): number | undefined {
  if (!/^\d{6}$/.test(code)) return undefined;
  const currentStep = calculateTotpTimeStep(at);
  for (let drift = -ACCEPTED_CLOCK_DRIFT_STEPS; drift <= ACCEPTED_CLOCK_DRIFT_STEPS; drift += 1) {
    const expected = Buffer.from(generateTotpCodeForTimeStep(secretBase32, currentStep + drift));
    if (timingSafeEqual(expected, Buffer.from(code))) return currentStep + drift;
  }
  return undefined;
}

export function buildTotpProvisioningUri(issuer: string, accountName: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const parameters = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: String(CODE_DIGITS), period: String(TIME_STEP_SECONDS) });
  return `otpauth://totp/${label}?${parameters.toString()}`;
}
