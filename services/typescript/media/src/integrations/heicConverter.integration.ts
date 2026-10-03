import type { MediaConfig } from "../configs/media.config.js";
import { runCommandWithoutShell, type CommandRunner } from "./ffmpegMediaTranscoder.integration.js";
import type { HeicConverter } from "./sharpImageProcessor.integration.js";

export function createHeicConverter(options: { readonly heifConvertPath: string; readonly ffmpeg: MediaConfig["ffmpeg"]; readonly run?: CommandRunner }): HeicConverter {
  const run = options.run ?? runCommandWithoutShell;
  return async (inputPath, outputJpegPath) => {
    try {
      await run(options.heifConvertPath, ["-q", "90", inputPath, outputJpegPath], 60_000);
      return true;
    } catch {
      // falls back to ffmpeg
    }
    if (options.ffmpeg.mode === "disabled") return false;
    try {
      await run(options.ffmpeg.ffmpegPath, ["-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file", "-i", inputPath, "-frames:v", "1", "-q:v", "2", "-y", outputJpegPath], 60_000);
      return true;
    } catch {
      return false;
    }
  };
}
