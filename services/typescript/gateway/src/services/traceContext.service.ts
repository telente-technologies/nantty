import { randomBytes } from "node:crypto";

const traceparentPattern = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly flags: string;
  readonly traceparent: string;
}

function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

export function startGatewaySpan(incomingTraceparent: string | undefined): TraceContext {
  const match = incomingTraceparent === undefined ? null : traceparentPattern.exec(incomingTraceparent.trim().toLowerCase());
  const validTrace = match !== null && match[1] !== "0".repeat(32) && match[2] !== "0".repeat(16);
  const traceId = validTrace ? (match[1] as string) : randomBytes(16).toString("hex");
  const flags = validTrace ? (match[3] as string) : "01";
  const spanId = generateSpanId();
  return { traceId, spanId, flags, traceparent: `00-${traceId}-${spanId}-${flags}` };
}
