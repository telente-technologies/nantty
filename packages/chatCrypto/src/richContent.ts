export interface ChatLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string | null;
  readonly liveUntil?: string | null;
}

export interface ChatPollOption {
  readonly id: string;
  readonly text: string;
}

export interface ChatPoll {
  readonly question: string;
  readonly allowMultipleAnswers: boolean;
  readonly options: readonly ChatPollOption[];
}

export type ChatControl =
  | { readonly type: "reaction"; readonly targetMessageId: string; readonly emoji: string; readonly remove: boolean }
  | { readonly type: "pollVote"; readonly targetMessageId: string; readonly optionIds: readonly string[] }
  | { readonly type: "locationUpdate"; readonly targetMessageId: string; readonly latitude: number; readonly longitude: number; readonly label: string | null }
  | { readonly type: "locationStop"; readonly targetMessageId: string }
  | { readonly type: "groupUpdate" };

export const maximumPollOptions = 6;
export const maximumLiveLocationMilliseconds = 8 * 60 * 60 * 1000;
const maximumEmojiLength = 32;

const isString = (value: unknown): value is string => typeof value === "string";
const isId = (value: unknown): value is string => isString(value) && value.length > 0 && value.length <= 100;
const isLatitude = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
const isLongitude = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
const readLabel = (value: unknown) => (isString(value) && value.trim() !== "" ? value.trim().slice(0, 200) : null);
const asRecord = (value: unknown): Record<string, unknown> | null => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

export function sanitizeLocation(value: unknown): ChatLocation | null {
  const candidate = asRecord(value);
  if (candidate === null || !isLatitude(candidate.latitude) || !isLongitude(candidate.longitude)) return null;
  const liveUntil = isString(candidate.liveUntil) && !Number.isNaN(Date.parse(candidate.liveUntil)) ? candidate.liveUntil : null;
  return { latitude: candidate.latitude, longitude: candidate.longitude, label: readLabel(candidate.label), ...(liveUntil === null ? {} : { liveUntil }) };
}

export function sanitizePoll(value: unknown): ChatPoll | null {
  const candidate = asRecord(value);
  if (candidate === null || !isString(candidate.question) || candidate.question.trim() === "" || !Array.isArray(candidate.options)) return null;
  const options: ChatPollOption[] = [];
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();
  for (const raw of candidate.options) {
    const option = asRecord(raw);
    if (option === null || !isId(option.id) || !isString(option.text) || option.text.trim() === "") return null;
    const text = option.text.trim().slice(0, 100);
    if (seenIds.has(option.id) || seenTexts.has(text.toLowerCase())) return null;
    seenIds.add(option.id);
    seenTexts.add(text.toLowerCase());
    options.push({ id: option.id, text });
  }
  if (options.length < 2 || options.length > maximumPollOptions) return null;
  return { question: candidate.question.trim().slice(0, 300), allowMultipleAnswers: candidate.allowMultipleAnswers === true, options };
}

export function sanitizeControl(value: unknown): ChatControl | null {
  const candidate = asRecord(value);
  if (candidate === null) return null;
  if (candidate.type === "groupUpdate") return { type: "groupUpdate" };
  if (!isId(candidate.targetMessageId)) return null;
  const targetMessageId = candidate.targetMessageId;
  switch (candidate.type) {
    case "reaction":
      return isString(candidate.emoji) && candidate.emoji.length > 0 && candidate.emoji.length <= maximumEmojiLength ? { type: "reaction", targetMessageId, emoji: candidate.emoji, remove: candidate.remove === true } : null;
    case "pollVote":
      return Array.isArray(candidate.optionIds) && candidate.optionIds.length <= maximumPollOptions && candidate.optionIds.every(isId) ? { type: "pollVote", targetMessageId, optionIds: [...new Set(candidate.optionIds as string[])] } : null;
    case "locationUpdate":
      return isLatitude(candidate.latitude) && isLongitude(candidate.longitude) ? { type: "locationUpdate", targetMessageId, latitude: candidate.latitude, longitude: candidate.longitude, label: readLabel(candidate.label) } : null;
    case "locationStop":
      return { type: "locationStop", targetMessageId };
    default:
      return null;
  }
}

export function createPollOptions(texts: readonly string[], random: (length: number) => Uint8Array): ChatPollOption[] {
  return texts.map((text) => ({ id: [...random(8)].map((byte) => byte.toString(16).padStart(2, "0")).join(""), text: text.trim() }));
}
