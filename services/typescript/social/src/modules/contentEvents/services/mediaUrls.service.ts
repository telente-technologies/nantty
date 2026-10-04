import type { ProcessedMediaVariant } from "../commands/applyProcessedMedia/applyProcessedMedia.command.js";

const imagePreference = ["webp", "jpeg", "jpg", "avif", "png"];
const videoPreference = ["mp4", "h264"];
const audioPreference = ["aac", "m4a", "mp3"];

export function publicMediaUrl(baseUrl: string, key: string | undefined): string | null {
  if (key === undefined || key === "" || baseUrl === "") return null;
  return `${baseUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

export function choosePrimaryVariant(kind: string | undefined, variants: readonly ProcessedMediaVariant[]): ProcessedMediaVariant | undefined {
  const preference = kind === "video" ? videoPreference : kind === "audio" ? audioPreference : imagePreference;
  const ranked = [...variants].sort((left, right) => {
    const leftRank = preference.indexOf(left.format.toLowerCase());
    const rightRank = preference.indexOf(right.format.toLowerCase());
    const byFormat = (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
    return byFormat !== 0 ? byFormat : right.width * right.height - left.width * left.height;
  });
  return ranked[0];
}
