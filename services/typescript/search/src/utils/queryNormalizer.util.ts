import { maximumQueryLength } from "../constants/search.constant.js";

export function normalizeSearchText(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_#@.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumQueryLength);
}

export function stripLeadingMarkers(normalized: string): string {
  return normalized.replace(/^[#@]+/, "");
}

export function extractQueryTokens(normalized: string): string[] {
  return stripLeadingMarkers(normalized)
    .split(/[\s.-]+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter((token) => token !== "")
    .slice(0, 8);
}

export function buildPrefixTsQuery(tokens: readonly string[]): string {
  return tokens.map((token, index) => (index === tokens.length - 1 ? `${token}:*` : token)).join(" & ");
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function normalizeHashtag(raw: string): string {
  return normalizeSearchText(raw).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
}
