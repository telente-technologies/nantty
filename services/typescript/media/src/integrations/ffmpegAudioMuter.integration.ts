import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { MediaConfig } from "../configs/media.config.js";
import { mutedDerivativeFolder } from "../constants/media.constant.js";
import { MediaRejectedError } from "../errors/media.error.js";
import type { AudioMuteInput, ProcessedFile, ProcessedMedia } from "../interfaces/mediaProcessors.interface.js";
import { buildHlsArgs, buildMasterPlaylist, buildProbeArgs, buildSilentSoundtrackArgs, parseProbeOutput, selectRenditions } from "../utils/ffmpegCommands.util.js";

type Runner = (command: string, args: readonly string[], timeoutMs: number) => Promise<string>;

const hlsContentTypes: Readonly<Record<string, string>> = { ".m3u8": "application/vnd.apple.mpegurl", ".ts": "video/mp2t" };

async function collectHlsFiles(directory: string, prefix: string): Promise<ProcessedFile[]> {
  const files: ProcessedFile[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...(await collectHlsFiles(path, `${name}/`)));
    else {
      const extension = entry.name.slice(entry.name.lastIndexOf("."));
      files.push({ name, contentType: hlsContentTypes[extension] ?? "application/octet-stream", format: extension.slice(1), width: 0, height: 0, isVariant: false, source: { path }, sizeBytes: (await stat(path)).size });
    }
  }
  return files;
}

export async function muteVideoAudioWithFfmpeg(run: Runner, config: MediaConfig["ffmpeg"], input: AudioMuteInput): Promise<ProcessedMedia> {
  const probe = parseProbeOutput(await run(config.ffprobePath, buildProbeArgs(input.inputPath), 60_000));
  if (!probe.hasVideo || probe.height === 0) throw new MediaRejectedError("NO_VIDEO_STREAM");
  const mutedMp4 = join(input.workDirectory, "muted.mp4");
  await run(config.ffmpegPath, buildSilentSoundtrackArgs(input.inputPath, mutedMp4), config.timeoutMs);
  const hlsRoot = join(input.workDirectory, "muted-hls");
  const entries: { width: number; height: number; bandwidthKbps: number; uri: string }[] = [];
  for (const rendition of selectRenditions(probe.height, config.maximumHeight)) {
    const directory = join(hlsRoot, `${rendition.height}p`);
    await mkdir(directory, { recursive: true });
    await run(config.ffmpegPath, buildHlsArgs(mutedMp4, directory, rendition), config.timeoutMs);
    const height = Math.min(rendition.height, probe.height);
    entries.push({ width: Math.round((probe.width * height) / probe.height / 2) * 2, height, bandwidthKbps: rendition.videoBitrateKbps + rendition.audioBitrateKbps, uri: `${rendition.height}p/index.m3u8` });
  }
  await writeFile(join(hlsRoot, "master.m3u8"), buildMasterPlaylist(entries));
  const top = entries.at(-1);
  const hlsMasterName = `${mutedDerivativeFolder}hls/master.m3u8`;
  const hlsFiles = (await collectHlsFiles(hlsRoot, `${mutedDerivativeFolder}hls/`)).map((file) => (file.name === hlsMasterName ? { ...file, format: "hls", isVariant: true, width: top?.width ?? 0, height: top?.height ?? 0 } : file));
  const mp4: ProcessedFile = { name: `${mutedDerivativeFolder}video.mp4`, contentType: "video/mp4", format: "mp4", width: probe.width, height: probe.height, isVariant: true, source: { path: mutedMp4 }, sizeBytes: (await stat(mutedMp4)).size };
  return { width: probe.width, height: probe.height, durationSeconds: probe.durationSeconds, files: [mp4, ...hlsFiles], hlsMasterName, moderationFrames: [] };
}
