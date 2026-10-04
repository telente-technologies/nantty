export interface Rendition {
  readonly height: number;
  readonly videoBitrateKbps: number;
  readonly audioBitrateKbps: number;
}

export const hlsLadder: readonly Rendition[] = [
  { height: 240, videoBitrateKbps: 400, audioBitrateKbps: 64 },
  { height: 480, videoBitrateKbps: 900, audioBitrateKbps: 96 },
  { height: 720, videoBitrateKbps: 2000, audioBitrateKbps: 128 },
  { height: 1080, videoBitrateKbps: 4500, audioBitrateKbps: 128 },
];

export interface ProbeSummary {
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly hasVideo: boolean;
  readonly hasAudio: boolean;
}

export function selectRenditions(sourceHeight: number, maximumHeight: number): readonly Rendition[] {
  const ceiling = Math.min(sourceHeight, maximumHeight);
  const fitting = hlsLadder.filter((rendition) => rendition.height <= ceiling);
  return fitting.length > 0 ? fitting : [hlsLadder[0] as Rendition];
}

const inputArgs = (input: string) => ["-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file", "-i", input];
const scaleFilter = (height: number) => `scale=-2:min(ih\\,${height})`;
const videoEncoding = (videoKbps: number) => ["-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p", "-b:v", `${videoKbps}k`, "-maxrate", `${Math.round(videoKbps * 1.2)}k`, "-bufsize", `${videoKbps * 2}k`];
const audioEncoding = (audioKbps: number) => ["-c:a", "aac", "-b:a", `${audioKbps}k`, "-ac", "2"];

export const buildProbeArgs = (input: string) => ["-v", "error", "-protocol_whitelist", "file", "-print_format", "json", "-show_format", "-show_streams", input];

export function buildMp4Args(input: string, output: string, rendition: Rendition): string[] {
  return [...inputArgs(input), "-map_metadata", "-1", "-map_chapters", "-1", "-vf", scaleFilter(rendition.height), ...videoEncoding(rendition.videoBitrateKbps), ...audioEncoding(rendition.audioBitrateKbps), "-movflags", "+faststart", "-y", output];
}

export function buildHlsArgs(input: string, directory: string, rendition: Rendition): string[] {
  return [
    ...inputArgs(input), "-map_metadata", "-1", "-map_chapters", "-1", "-vf", scaleFilter(rendition.height), ...videoEncoding(rendition.videoBitrateKbps), ...audioEncoding(rendition.audioBitrateKbps),
    "-g", "96", "-sc_threshold", "0", "-hls_time", "4", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments",
    "-hls_segment_filename", `${directory}/segment%05d.ts`, "-y", `${directory}/index.m3u8`,
  ];
}

export function buildFrameArgs(input: string, output: string, atSeconds: number, width: number): string[] {
  return ["-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file", "-ss", atSeconds.toFixed(2), "-i", input, "-frames:v", "1", "-vf", `scale='min(iw\\,${width})':-2`, "-map_metadata", "-1", "-q:v", "3", "-y", output];
}

export function buildAudioArgs(input: string, output: string): string[] {
  return [...inputArgs(input), "-vn", "-map_metadata", "-1", ...audioEncoding(64), "-ar", "44100", "-movflags", "+faststart", "-y", output];
}

export function buildSilentSoundtrackArgs(input: string, output: string): string[] {
  return [
    ...inputArgs(input), "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-map", "0:v:0", "-map", "1:a:0", "-map_metadata", "-1", "-map_chapters", "-1",
    "-c:v", "copy", ...audioEncoding(64), "-shortest", "-movflags", "+faststart", "-y", output,
  ];
}

export function buildMasterPlaylist(entries: readonly { readonly width: number; readonly height: number; readonly bandwidthKbps: number; readonly uri: string }[]): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-INDEPENDENT-SEGMENTS"];
  for (const entry of entries) lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${entry.bandwidthKbps * 1000},RESOLUTION=${entry.width}x${entry.height},CODECS="avc1.4d401f,mp4a.40.2"`, entry.uri);
  return `${lines.join("\n")}\n`;
}

export function parseProbeOutput(output: string): ProbeSummary {
  const parsed = JSON.parse(output) as { streams?: { codec_type?: string; width?: number; height?: number; duration?: string; tags?: { rotate?: string } }[]; format?: { duration?: string } };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const duration = Number(parsed.format?.duration ?? video?.duration ?? 0);
  const rotated = Math.abs(Number(video?.tags?.rotate ?? 0)) % 180 === 90;
  return {
    width: (rotated ? video?.height : video?.width) ?? 0,
    height: (rotated ? video?.width : video?.height) ?? 0,
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    hasVideo: video !== undefined,
    hasAudio: parsed.streams?.some((stream) => stream.codec_type === "audio") ?? false,
  };
}
