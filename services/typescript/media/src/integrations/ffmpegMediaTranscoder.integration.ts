import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { MediaConfig } from "../configs/media.config.js";
import { MediaRejectedError, ProcessorUnavailableError } from "../errors/media.error.js";
import type { AudioMuteInput, MediaTranscoder, ProcessedFile, ProcessedMedia, ProcessingInput } from "../interfaces/mediaProcessors.interface.js";
import { muteVideoAudioWithFfmpeg } from "./ffmpegAudioMuter.integration.js";
import { createFpcalcAudioFingerprinter } from "./fpcalcAudioFingerprinter.integration.js";
import { buildAudioArgs, buildFrameArgs, buildHlsArgs, buildMasterPlaylist, buildMp4Args, buildProbeArgs, parseProbeOutput, selectRenditions } from "../utils/ffmpegCommands.util.js";

const execFileAsync = promisify(execFile);
const outputBufferBytes = 8 * 1024 * 1024;
const contentTypes: Readonly<Record<string, string>> = { ".m3u8": "application/vnd.apple.mpegurl", ".ts": "video/mp2t", ".mp4": "video/mp4", ".m4a": "audio/mp4", ".jpg": "image/jpeg" };

export type CommandRunner = (command: string, args: readonly string[], timeoutMs: number) => Promise<string>;

export const runCommandWithoutShell: CommandRunner = async (command, args, timeoutMs) => (await execFileAsync(command, [...args], { timeout: timeoutMs, maxBuffer: outputBufferBytes, windowsHide: true })).stdout;

async function collectFiles(directory: string, prefix: string, isVariant: (name: string) => boolean): Promise<ProcessedFile[]> {
  const files: ProcessedFile[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...(await collectFiles(path, `${name}/`, isVariant)));
    else {
      const extension = entry.name.slice(entry.name.lastIndexOf("."));
      files.push({ name, contentType: contentTypes[extension] ?? "application/octet-stream", format: extension.slice(1), width: 0, height: 0, isVariant: isVariant(name), source: { path }, sizeBytes: (await stat(path)).size });
    }
  }
  return files;
}

export function createFfmpegMediaTranscoder(options: { readonly config: MediaConfig["ffmpeg"]; readonly run?: CommandRunner }): MediaTranscoder {
  const { config } = options;
  const run = options.run ?? runCommandWithoutShell;
  let available: Promise<boolean> | undefined;
  const isAvailable = () => {
    available ??= config.mode === "disabled" ? Promise.resolve(false) : run(config.ffmpegPath, ["-version"], 10_000).then(() => true, () => false);
    return available;
  };
  const requireAvailable = async () => {
    if (!(await isAvailable())) throw new ProcessorUnavailableError("ffmpeg is not available on this worker.");
  };
  const ffmpeg = (args: readonly string[]) => run(config.ffmpegPath, args, config.timeoutMs);
  const computeAudioFingerprint = createFpcalcAudioFingerprinter(run, config);

  return {
    isAvailable,
    computeAudioFingerprint,
    async processVideo(input: ProcessingInput): Promise<ProcessedMedia> {
      await requireAvailable();
      const probe = parseProbeOutput(await run(config.ffprobePath, buildProbeArgs(input.inputPath), 60_000));
      if (!probe.hasVideo || probe.width === 0 || probe.height === 0) throw new MediaRejectedError("NO_VIDEO_STREAM");
      if (input.maximumDurationSeconds !== undefined && probe.durationSeconds > input.maximumDurationSeconds) throw new MediaRejectedError("DURATION_EXCEEDED");
      const renditions = selectRenditions(probe.height, config.maximumHeight);
      const top = renditions.at(-1) ?? renditions[0];
      if (top === undefined) throw new MediaRejectedError("NO_VIDEO_STREAM");
      const mp4Path = join(input.workDirectory, "video.mp4");
      await ffmpeg(buildMp4Args(input.inputPath, mp4Path, top));
      const hlsRoot = join(input.workDirectory, "hls");
      const playlistEntries: { width: number; height: number; bandwidthKbps: number; uri: string }[] = [];
      for (const rendition of renditions) {
        const directory = join(hlsRoot, `${rendition.height}p`);
        await mkdir(directory, { recursive: true });
        await ffmpeg(buildHlsArgs(input.inputPath, directory, rendition));
        const height = Math.min(rendition.height, probe.height);
        playlistEntries.push({ width: Math.round((probe.width * height) / probe.height / 2) * 2, height, bandwidthKbps: rendition.videoBitrateKbps + rendition.audioBitrateKbps, uri: `${rendition.height}p/index.m3u8` });
      }
      await writeFile(join(hlsRoot, "master.m3u8"), buildMasterPlaylist(playlistEntries));
      const frames: Uint8Array[] = [];
      const frameFiles: ProcessedFile[] = [];
      const positions = [0.1, 0.4, 0.7].map((fraction) => Math.max(0, probe.durationSeconds * fraction));
      for (const [index, position] of positions.entries()) {
        const name = index === 0 ? "poster.jpg" : `thumbnail${index}.jpg`;
        const path = join(input.workDirectory, name);
        await ffmpeg(buildFrameArgs(input.inputPath, path, position, index === 0 ? 720 : 320));
        frames.push(await readFile(path));
        frameFiles.push({ name, contentType: "image/jpeg", format: "jpeg", width: 0, height: 0, isVariant: false, source: { path }, sizeBytes: (await stat(path)).size });
      }
      const hlsFiles = await collectFiles(hlsRoot, "hls/", (name) => name === "hls/master.m3u8");
      const topEntry = playlistEntries.at(-1);
      const mp4: ProcessedFile = { name: "video.mp4", contentType: "video/mp4", format: "mp4", width: topEntry?.width ?? probe.width, height: topEntry?.height ?? probe.height, bitrateKbps: top.videoBitrateKbps, isVariant: true, source: { path: mp4Path }, sizeBytes: (await stat(mp4Path)).size };
      return { width: probe.width, height: probe.height, durationSeconds: probe.durationSeconds, files: [mp4, ...hlsFiles.map((file) => (file.name === "hls/master.m3u8" ? { ...file, format: "hls", width: topEntry?.width ?? 0, height: topEntry?.height ?? 0 } : file)), ...frameFiles], posterName: "poster.jpg", hlsMasterName: "hls/master.m3u8", moderationFrames: frames };
    },
    async processAudio(input: ProcessingInput): Promise<ProcessedMedia> {
      await requireAvailable();
      const probe = parseProbeOutput(await run(config.ffprobePath, buildProbeArgs(input.inputPath), 60_000));
      if (!probe.hasAudio) throw new MediaRejectedError("NO_AUDIO_STREAM");
      if (input.maximumDurationSeconds !== undefined && probe.durationSeconds > input.maximumDurationSeconds) throw new MediaRejectedError("DURATION_EXCEEDED");
      const outputPath = join(input.workDirectory, "audio.m4a");
      await ffmpeg(buildAudioArgs(input.inputPath, outputPath));
      const file: ProcessedFile = { name: "audio.m4a", contentType: "audio/mp4", format: "m4a", width: 0, height: 0, bitrateKbps: 64, isVariant: true, source: { path: outputPath }, sizeBytes: (await stat(outputPath)).size };
      return { width: 0, height: 0, durationSeconds: probe.durationSeconds, files: [file], moderationFrames: [] };
    },
    async muteVideoAudio(input: AudioMuteInput): Promise<ProcessedMedia> {
      await requireAvailable();
      return muteVideoAudioWithFfmpeg(run, config, input);
    },
  };
}
