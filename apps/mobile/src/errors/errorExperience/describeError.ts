import type { ErrorDescriptor, ErrorKind, ErrorSubject } from "./errorKinds";
import { describeErrorSignal, errorKindByCode } from "./errorMapper";
import { readErrorSignal } from "./errorSignal";

export const genericErrorKinds: ReadonlySet<ErrorKind> = new Set(["unknown", "serverError", "timeout"]);
const connectionSensitiveKinds: ReadonlySet<ErrorKind> = new Set(["unknown", "serverError", "timeout", "maintenance", "mediaFailed", "uploadFailed"]);

export interface DescribeInput {
  readonly error?: unknown;
  readonly kind?: ErrorKind;
  readonly subject?: ErrorSubject;
  readonly reference?: string;
  readonly code?: string;
  readonly isOnline?: boolean;
}

export function describeError({ error, kind, subject, reference, code, isOnline = true }: DescribeInput): ErrorDescriptor {
  const signal = readErrorSignal(error);
  const descriptor = describeErrorSignal({ ...signal, code: signal.code ?? code, requestId: reference ?? signal.requestId }, { kind, subject });
  if (!isOnline && kind === undefined && connectionSensitiveKinds.has(descriptor.kind)) return describeErrorSignal({ status: 0, code: "NETWORK_UNAVAILABLE", requestId: descriptor.reference });
  return descriptor;
}

export function describeActionFailure(error: unknown, fallback = "That didn't work. Try again."): string {
  const signal = readErrorSignal(error);
  const descriptor = describeError({ error });
  const isExplicitlyMapped = signal.code !== undefined && errorKindByCode[signal.code.toUpperCase()] !== undefined;
  const isTransportFailure = descriptor.kind === "offline" || descriptor.kind === "timeout" || signal.status === 429 || (signal.status ?? 0) >= 500;
  if (descriptor.kind !== "unknown" && (isExplicitlyMapped || isTransportFailure)) return descriptor.description;
  return error instanceof Error && error.message && !/^Request failed \(HTTP/.test(error.message) ? error.message : fallback;
}
