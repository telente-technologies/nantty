import { describe, expect, it } from "vitest";

import fixtures from "../fixtures/signal-v1-serialization.json";
import { encodeEnvelope, parseEnvelope, type DirectEnvelope, type GroupEnvelope } from "../src/envelope";
import { decodePayload, encodePayload, type ChatPayload, type ChatPayloadInput } from "../src/payload";
import { utf8Encode } from "../src/bytes.util";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

describe("shared signal-v1 serialization fixture", () => {
  it("round-trips the direct envelope using the shared wire representation", () => {
    const fixture = fixtures.directEnvelope;
    const value = fixture.value as DirectEnvelope;
    expect(canonicalJson(JSON.parse(encodeEnvelope(value)))).toBe(canonicalJson(JSON.parse(fixture.wire)));
    expect(parseEnvelope(fixture.wire)).toEqual(value);
  });

  it("round-trips the group envelope using the shared wire representation", () => {
    const fixture = fixtures.groupEnvelope;
    const value = fixture.value as GroupEnvelope;
    expect(canonicalJson(JSON.parse(encodeEnvelope(value)))).toBe(canonicalJson(JSON.parse(fixture.wire)));
    expect(parseEnvelope(fixture.wire)).toEqual(value);
  });

  it("round-trips the inner payload using the shared wire representation", () => {
    const fixture = fixtures.innerPayload;
    const input: ChatPayloadInput = fixture.input;
    const encoded = encodePayload(input, new Date("2026-11-05T12:00:00.000Z"));
    expect(canonicalJson(JSON.parse(new TextDecoder().decode(encoded)))).toBe(canonicalJson(JSON.parse(fixture.wire)));
    expect(decodePayload(utf8Encode(fixture.wire))).toEqual(fixture.decoded as ChatPayload);
  });

  it("accepts timezone-free ISO live-location timestamps as the Android codec does", () => {
    const payload = decodePayload(utf8Encode(JSON.stringify({
      v: 1,
      text: "",
      sentAt: "2026-11-05T12:00:00.000Z",
      location: { latitude: 6.5, longitude: 3.4, liveUntil: "2026-11-05T12:30:45" },
    })));

    expect(payload.location?.liveUntil).toBe("2026-11-05T12:30:45");
  });
});
