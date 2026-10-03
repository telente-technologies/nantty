import { purposePolicies, type MediaPurposeName, type PurposeRule } from "../constants/purposePolicy.constant.js";
import { payloadTooLarge, unsupportedMediaType } from "../errors/media.error.js";
import { areMimeTypesCompatible, normalizeMimeType } from "./magicBytes.util.js";

export function findRuleForMimeType(purpose: MediaPurposeName, mimeType: string): PurposeRule | undefined {
  const normalized = normalizeMimeType(mimeType);
  return purposePolicies[purpose].rules.find((rule) => rule.mimeTypes.some((allowed) => areMimeTypesCompatible(allowed, normalized)));
}

export function requireUploadAllowed(purpose: MediaPurposeName, mimeType: string, sizeBytes: number): PurposeRule {
  const rule = findRuleForMimeType(purpose, mimeType);
  if (rule === undefined) throw unsupportedMediaType(`${mimeType} is not allowed for ${purpose} uploads.`);
  if (sizeBytes > rule.maximumBytes) throw payloadTooLarge(`This ${rule.kind} is larger than the ${Math.floor(rule.maximumBytes / 1024 / 1024)} MB limit for ${purpose} uploads.`, rule.maximumBytes);
  return rule;
}

