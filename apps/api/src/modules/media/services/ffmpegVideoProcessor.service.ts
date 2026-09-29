import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  HLS_LADDER,
  UnprocessableMediaError,
  type ProcessedVideo,
  type ProcessedVideoFile,
  type ProcessedVideoRendition,
  type VideoProbeResult,
  type VideoProcessor,
  type VideoTranscodeRequest,
} from "../models/mediaProcessing.model.js";
import { runProcessWithArguments } from "./processRunner.service.js";

const PROBE_TIMEOUT_MS = 60_000;
const TRANSCODE_TIMEOUT_MS = 30 * 60_000;
const MP4_AUDIO_KBPS = 128;
const SAFE_INPUT = ["-protocol_whitelist", "file", "-f", "mov", "-i"] as const;

interface ProbeStream {
  readonly codec_type?: string;
  readonly width?: number;
  readonly height?: number;
  readonly tags?: { readonly rotate?: string };
  readonly side_data_list?: readonly { readonly rotation?: number }[];
}

interface ProbeOutput {
  readonly streams?: readonly ProbeStream[];
  readonly format?: { readonly duration?: string };
}

interface ScaledRung {
  readonly width: number;
  readonly height: number;
  readonly videoBitrateKbps: number;
  readonly audioBitrateKbps: number;
  readonly name: string;
}

function roundToEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function readRotationDegrees(stream: ProbeStream): number {
  const rotation = stream.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation ?? Number(stream.tags?.rotate ?? 0);
  return Math.abs(Number.isFinite(rotation) ? rotation : 0) % 180;
}

function planLadder(probe: VideoProbeResult): readonly ScaledRung[] {
  const shortSide = Math.min(probe.width, probe.height);
  const isPortrait = probe.height > probe.width;
  const fitting = HLS_LADDER.filter((rung) => rung.height <= shortSide);
  const rungs = fitting.length > 0 ? fitting : [{ ...HLS_LADDER[0], height: roundToEven(shortSide) }];
  return rungs.map((rung) => {
    const longSide = roundToEven((Math.max(probe.width, probe.height) * rung.height) / shortSide);
    const width = isPortrait ? rung.height : longSide;
    const height = isPortrait ? longSide : rung.height;
    return { width, height, videoBitrateKbps: rung.videoBitrateKbps, audioBitrateKbps: rung.audioBitrateKbps, name: `${rung.height}p` };
  });
}

function h264Arguments(rung: ScaledRung): string[] {
  return [
    "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1", "-sn", "-dn",
    "-vf", `scale=${rung.width}:${rung.height}`,
    "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-b:v", `${rung.videoBitrateKbps}k`, "-maxrate", `${Math.round(rung.videoBitrateKbps * 1.1)}k`, "-bufsize", `${rung.videoBitrateKbps * 2}k`,
    "-c:a", "aac", "-b:a", `${rung.audioBitrateKbps}k`, "-ac", "2",
  ];
}

async function listFilesRecursively(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

export class FfmpegVideoProcessor implements VideoProcessor {
  public constructor(private readonly binaries: { readonly ffmpegPath: string; readonly ffprobePath: string }) {}

  public async probeVideo(sourcePath: string, signal?: AbortSignal): Promise<VideoProbeResult> {
    const probeArguments = ["-v", "error", "-f", "mov", "-print_format", "json", "-show_format", "-show_streams", sourcePath];
    const result = await runProcessWithArguments(this.binaries.ffprobePath, probeArguments, { timeoutMs: PROBE_TIMEOUT_MS, ...(signal === undefined ? {} : { signal }) });
    if (result.exitCode !== 0) throw new UnprocessableMediaError("This video could not be read.");
    let parsed: ProbeOutput;
    try {
      parsed = JSON.parse(result.standardOutput) as ProbeOutput;
    } catch {
      throw new UnprocessableMediaError("This video could not be read.");
    }
    const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video");
    const durationSeconds = Number(parsed.format?.duration);
    if (videoStream?.width === undefined || videoStream.height === undefined || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new UnprocessableMediaError("This file has no playable video.");
    }
    const rotated = readRotationDegrees(videoStream) === 90;
    return {
      width: rotated ? videoStream.height : videoStream.width,
      height: rotated ? videoStream.width : videoStream.height,
      durationSeconds: Math.round(durationSeconds * 1000) / 1000,
    };
  }

  public async transcodeVideo(request: VideoTranscodeRequest): Promise<ProcessedVideo> {
    const ladder = planLadder(request.probe);
    const topRung = ladder[ladder.length - 1] as ScaledRung;
    const mp4Path = join(request.outputDirectory, "video.mp4");
    const posterPath = join(request.outputDirectory, "poster.jpg");
    const hlsDirectory = join(request.outputDirectory, "hls");
    await this.runFfmpeg(["-y", ...SAFE_INPUT, request.sourcePath, ...h264Arguments(topRung), "-movflags", "+faststart", mp4Path], request.signal);
    const posterSecond = Math.min(1, request.probe.durationSeconds / 2).toFixed(2);
    await this.runFfmpeg(["-y", "-ss", posterSecond, ...SAFE_INPUT, request.sourcePath, "-map_metadata", "-1", "-frames:v", "1", "-vf", `scale=${topRung.width}:${topRung.height}`, "-q:v", "3", posterPath], request.signal);
    for (const rung of ladder) {
      const rungDirectory = join(hlsDirectory, rung.name);
      await mkdir(rungDirectory, { recursive: true });
      await this.runFfmpeg([
        "-y", ...SAFE_INPUT, request.sourcePath, ...h264Arguments(rung),
        "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
        "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod",
        "-hls_segment_filename", join(rungDirectory, "segment_%04d.ts"),
        join(rungDirectory, "index.m3u8"),
      ], request.signal);
    }
    await writeFile(join(hlsDirectory, "master.m3u8"), this.buildMasterPlaylist(ladder));
    const hlsFiles: ProcessedVideoFile[] = (await listFilesRecursively(hlsDirectory)).map((localPath) => ({
      localPath,
      relativePath: relative(hlsDirectory, localPath).split("\\").join("/"),
      contentType: localPath.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t",
    }));
    const renditions: ProcessedVideoRendition[] = ladder.map((rung) => ({ width: rung.width, height: rung.height, bitrateKbps: rung.videoBitrateKbps + rung.audioBitrateKbps }));
    return {
      mp4: { localPath: mp4Path, relativePath: "video.mp4", contentType: "video/mp4", width: topRung.width, height: topRung.height, bitrateKbps: topRung.videoBitrateKbps + MP4_AUDIO_KBPS },
      poster: { localPath: posterPath, relativePath: "poster.jpg", contentType: "image/jpeg", width: topRung.width, height: topRung.height },
      hlsMasterRelativePath: "master.m3u8",
      hlsFiles,
      hlsRenditions: renditions,
    };
  }

  private buildMasterPlaylist(ladder: readonly ScaledRung[]): string {
    const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
    for (const rung of ladder) {
      const bandwidth = (rung.videoBitrateKbps + rung.audioBitrateKbps) * 1100;
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${rung.width}x${rung.height},CODECS="avc1.640028,mp4a.40.2"`, `${rung.name}/index.m3u8`);
    }
    return `${lines.join("\n")}\n`;
  }

  private async runFfmpeg(argumentList: readonly string[], signal: AbortSignal | undefined): Promise<void> {
    const result = await runProcessWithArguments(this.binaries.ffmpegPath, ["-hide_banner", "-nostdin", "-loglevel", "error", ...argumentList], {
      timeoutMs: TRANSCODE_TIMEOUT_MS,
      ...(signal === undefined ? {} : { signal }),
    });
    if (result.exitCode !== 0) throw new Error(`ffmpeg exited with code ${String(result.exitCode)}: ${result.standardError.slice(-2_000)}`);
  }
}
