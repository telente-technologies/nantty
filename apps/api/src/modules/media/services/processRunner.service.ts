import { spawn } from "node:child_process";

const MAX_CAPTURED_OUTPUT_BYTES = 256 * 1024;

export interface ProcessRunResult {
  readonly exitCode: number | null;
  readonly standardOutput: string;
  readonly standardError: string;
}

export class ProcessStartError extends Error {
  public override readonly name = "ProcessStartError";
}

function appendBounded(current: string, addition: Buffer): string {
  const combined = current + addition.toString("utf8");
  return combined.length > MAX_CAPTURED_OUTPUT_BYTES ? combined.slice(-MAX_CAPTURED_OUTPUT_BYTES) : combined;
}

export function runProcessWithArguments(binaryPath: string, argumentList: readonly string[], options: { timeoutMs: number; signal?: AbortSignal }): Promise<ProcessRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, [...argumentList], { shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let standardOutput = "";
    let standardError = "";
    let settled = false;
    const stop = () => child.kill("SIGKILL");
    const timer = setTimeout(stop, options.timeoutMs);
    options.signal?.addEventListener("abort", stop, { once: true });
    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", stop);
      outcome();
    };
    child.stdout.on("data", (data: Buffer) => {
      standardOutput = appendBounded(standardOutput, data);
    });
    child.stderr.on("data", (data: Buffer) => {
      standardError = appendBounded(standardError, data);
    });
    child.on("error", (error) => finish(() => reject(new ProcessStartError(`Could not start ${binaryPath}: ${error.message}`))));
    child.on("close", (exitCode) => finish(() => resolve({ exitCode, standardOutput, standardError })));
  });
}
