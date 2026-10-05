import { sha256 } from "@noble/hashes/sha2.js";

import type { RandomSource } from "../src";

export function seededRandom(seed: string): RandomSource {
  let counter = 0;
  return (length) => {
    const output = new Uint8Array(length);
    for (let offset = 0; offset < length; offset += 32) {
      const block = sha256(new TextEncoder().encode(`${seed}:${counter++}`));
      output.set(block.slice(0, Math.min(32, length - offset)), offset);
    }
    return output;
  };
}

export const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
export const fromHex = (text: string) => new Uint8Array((text.match(/.{2}/g) ?? []).map((pair) => parseInt(pair, 16)));
