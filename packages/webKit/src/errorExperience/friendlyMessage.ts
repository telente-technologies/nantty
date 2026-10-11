import type { ErrorKind } from "./errorKinds";
import { describeErrorSignal } from "./errorMapper";
import { readErrorSignal } from "./errorSignal";

const serverWrittenKinds = new Set(["unknown", "notFound", "versionConflict", "alreadyDone"]);

export function isServerWrittenError(error: unknown): boolean {
  const signal = readErrorSignal(error);
  const status = signal.status ?? 0;
  return status >= 400 && status < 500 && serverWrittenKinds.has(describeErrorSignal(signal).kind) && error instanceof Error && error.message.trim().length > 0;
}

export function readFriendlyErrorMessage(error: unknown): string {
  if (isServerWrittenError(error)) return (error as Error).message.trim();
  const descriptor = describeErrorSignal(readErrorSignal(error));
  return `${descriptor.title}. ${descriptor.description}`;
}

export function resolveCallerErrorCopy(error: unknown, message: string | undefined): { readonly kind?: ErrorKind; readonly description?: string } {
  if (error === undefined || error === null) return { kind: "unknown", description: message };
  const kind = describeErrorSignal(readErrorSignal(error)).kind;
  if ((kind === "unknown" || kind === "notFound") && isServerWrittenError(error)) return { kind: "unknown", description: (error as Error).message.trim() };
  return {};
}
