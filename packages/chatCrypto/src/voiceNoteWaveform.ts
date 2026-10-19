export const voiceNoteWaveformPeakCount = 48;
export const maximumVoiceNoteWaveformPeak = 255;
export const voiceNoteBarCount = 28;
export const silentMeteringDecibels = -55;

const maximumAcceptedPeakCount = 256;

const clampToUnit = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function levelFromDecibels(decibels: number | null | undefined): number {
  if (typeof decibels !== "number" || !Number.isFinite(decibels)) return 0;
  return clampToUnit((decibels - silentMeteringDecibels) / -silentMeteringDecibels);
}

export function levelFromTimeDomainSamples(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sumOfSquares = 0;
  for (let index = 0; index < samples.length; index++) sumOfSquares += (samples[index] ?? 0) ** 2;
  const rootMeanSquare = Math.sqrt(sumOfSquares / samples.length);
  return rootMeanSquare > 0 ? levelFromDecibels(20 * Math.log10(rootMeanSquare)) : 0;
}

export function liveWaveformWindow(levels: readonly number[], barCount: number = voiceNoteBarCount): (number | null)[] {
  const newest = levels.slice(-barCount).map(clampToUnit);
  return [...Array.from({ length: barCount - newest.length }, () => null), ...newest];
}

export function downsampleLevelsByBucketMax(levels: readonly number[], bucketCount: number): number[] {
  if (bucketCount <= 0) return [];
  if (levels.length === 0) return Array.from({ length: bucketCount }, () => 0);
  return Array.from({ length: bucketCount }, (_, bucket) => {
    const start = Math.floor((bucket * levels.length) / bucketCount);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) * levels.length) / bucketCount));
    let peak = 0;
    for (let index = start; index < end; index++) peak = Math.max(peak, clampToUnit(levels[index] ?? 0));
    return peak;
  });
}

export function encodeVoiceNoteWaveform(levels: readonly number[]): number[] {
  return downsampleLevelsByBucketMax(levels, voiceNoteWaveformPeakCount).map((level) => Math.round(level * maximumVoiceNoteWaveformPeak));
}

export function sanitizeVoiceNoteWaveform(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumAcceptedPeakCount) return null;
  if (!value.every((peak) => typeof peak === "number" && Number.isFinite(peak))) return null;
  return (value as number[]).map((peak) => Math.min(maximumVoiceNoteWaveformPeak, Math.max(0, Math.round(peak))));
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  return hash >>> 0;
}

export function placeholderVoiceNoteWaveform(seed: string): number[] {
  let state = hashSeed(seed) || 1;
  const nextRandom = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  let previous = 0.5;
  return Array.from({ length: voiceNoteWaveformPeakCount }, () => {
    previous = previous * 0.45 + nextRandom() * 0.55;
    return Math.round((0.18 + previous * 0.6) * maximumVoiceNoteWaveformPeak);
  });
}

export function voiceNoteDisplayLevels(peaks: readonly number[] | null | undefined, placeholderSeed: string, barCount: number = voiceNoteBarCount): number[] {
  const usablePeaks = sanitizeVoiceNoteWaveform(peaks) ?? placeholderVoiceNoteWaveform(placeholderSeed);
  return downsampleLevelsByBucketMax(usablePeaks.map((peak) => peak / maximumVoiceNoteWaveformPeak), barCount);
}

export const voiceNoteBarHeight = (level: number | null, minimumHeight = 4, levelRange = 28) => minimumHeight + clampToUnit(level ?? 0) * levelRange;
