import type { MediaConfig } from "../configs/media.config.js";
import type { AudioFingerprint } from "../interfaces/mediaProcessors.interface.js";

type Runner = (command: string, args: readonly string[], timeoutMs: number) => Promise<string>;

export const maximumFingerprintSeconds = 180;

export function buildFpcalcArgs(inputPath: string): string[] {
  return ["-raw", "-json", "-length", String(maximumFingerprintSeconds), inputPath];
}

export function parseFpcalcOutput(output: string): AudioFingerprint | null {
  try {
    const parsed = JSON.parse(output) as { duration?: unknown; fingerprint?: unknown };
    if (!Array.isArray(parsed.fingerprint) || parsed.fingerprint.length === 0 || !parsed.fingerprint.every((value) => Number.isInteger(value))) return null;
    return { algorithm: "chromaprint", durationSeconds: typeof parsed.duration === "number" ? parsed.duration : 0, fingerprint: parsed.fingerprint as number[] };
  } catch {
    return null;
  }
}

export function createFpcalcAudioFingerprinter(run: Runner, config: MediaConfig["ffmpeg"]) {
  let available: Promise<boolean> | undefined;
  return async (inputPath: string): Promise<AudioFingerprint | null> => {
    available ??= config.mode === "disabled" ? Promise.resolve(false) : run(config.fpcalcPath, ["-version"], 10_000).then(() => true, () => false);
    if (!(await available)) return null;
    return parseFpcalcOutput(await run(config.fpcalcPath, buildFpcalcArgs(inputPath), 120_000));
  };
}
