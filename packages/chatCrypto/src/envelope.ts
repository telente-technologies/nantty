import { ChatCryptoError } from "./errors";

export interface PairwiseEntry {
  readonly u: string;
  readonly d: string;
  readonly b: string;
}

export interface DirectEnvelope {
  readonly v: 1;
  readonly t: "p";
  readonly s: string;
  readonly p: string;
  readonly n: string;
  readonly r: readonly PairwiseEntry[];
}

export interface GroupEnvelope {
  readonly v: 1;
  readonly t: "g";
  readonly s: string;
  readonly g: string;
  readonly r: readonly PairwiseEntry[];
}

export type MessageEnvelope = DirectEnvelope | GroupEnvelope;

export const encryptionProtocol = "signal-v1";
export const maximumEnvelopeLength = 65_536;

export function encodeEnvelope(envelope: MessageEnvelope): string {
  const text = JSON.stringify(envelope);
  if (text.length > maximumEnvelopeLength) throw new ChatCryptoError("ENVELOPE_TOO_LARGE", "This conversation has too many devices for one encrypted message.");
  return text;
}

const isString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

export function parseEnvelope(text: string): MessageEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ChatCryptoError("INVALID_MESSAGE", "The encrypted envelope is malformed.");
  }
  const candidate = (parsed ?? {}) as Record<string, unknown>;
  const entries = candidate.r;
  const validEntries = Array.isArray(entries) && entries.every((entry: unknown) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    return isString(record.u) && isString(record.d) && isString(record.b);
  });
  if (candidate.v !== 1 || !isString(candidate.s) || !validEntries) throw new ChatCryptoError("INVALID_MESSAGE", "The encrypted envelope is malformed.");
  if (candidate.t === "p" && isString(candidate.p) && isString(candidate.n)) return candidate as unknown as DirectEnvelope;
  if (candidate.t === "g" && isString(candidate.g)) return candidate as unknown as GroupEnvelope;
  throw new ChatCryptoError("INVALID_MESSAGE", "The encrypted envelope is malformed.");
}
