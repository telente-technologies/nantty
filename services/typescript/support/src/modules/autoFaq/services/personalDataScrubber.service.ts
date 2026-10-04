import {
  capitalisedPairPattern, dashSignaturePattern, greetingNamePattern, honorificNamePattern, introductionNamePattern, namedPersonPattern, personalDataPatterns,
  placeholderFor, placeholderPattern, platformVocabulary, signOffNamePattern, type RedactionKind,
} from "../../../constants/personalDataPatterns.constant.js";

export interface ScrubContext {
  readonly knownNames?: readonly string[];
  readonly knownUsernames?: readonly string[];
}

export interface ScrubResult {
  readonly text: string;
  readonly redactionCount: number;
  readonly redactedKinds: readonly RedactionKind[];
}

const zeroWidthCharacters = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
const placeholderProbe = new RegExp(placeholderPattern.source);

function passesLuhnCheck(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function knownNamePatterns(names: readonly string[]): RegExp[] {
  const fullNames = new Set<string>();
  const parts = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length >= 2) fullNames.add(trimmed);
    for (const part of trimmed.split(/[\s._-]+/)) if (part.length >= 3 && !platformVocabulary.has(part.toLowerCase())) parts.add(part);
  }
  const bounded = (body: string, flags: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, flags);
  const byLength = (values: Iterable<string>) => [...values].sort((first, second) => second.length - first.length);
  return [
    ...byLength(fullNames).map((full) => bounded(escapeForPattern(full), "giu")),
    ...byLength(parts).map((part) => bounded([capitalise(part), part.toUpperCase()].map(escapeForPattern).join("|"), "gu")),
  ];
}

class Redactor {
  public text: string;
  public count = 0;
  public readonly kinds = new Set<RedactionKind>();

  public constructor(text: string) {
    this.text = text;
  }

  public apply(kind: RedactionKind, pattern: RegExp, keepPrefixGroup = false, accept: (match: string) => boolean = () => true): void {
    this.text = this.text.replace(pattern, (match: string, ...groups: unknown[]) => {
      const prefix = keepPrefixGroup && typeof groups[0] === "string" && match.startsWith(groups[0]) ? groups[0] : "";
      const core = match.slice(prefix.length);
      if (core.trim() === "" || placeholderProbe.test(core) || !accept(core)) return match;
      this.count += 1;
      this.kinds.add(kind);
      return `${prefix}${placeholderFor(kind)}`;
    });
  }

  public applyNameAfterLeadIn(pattern: RegExp): void {
    this.text = this.text.replace(pattern, (match: string, leadIn: string, gap: string, name: string) => {
      if (typeof name !== "string" || name.split(/\s+/).every((word) => platformVocabulary.has(word.toLowerCase()))) return match;
      this.count += 1;
      this.kinds.add("name");
      return `${leadIn}${gap}${placeholderFor("name")}`;
    });
  }
}

export function scrubPersonalData(input: string, context: ScrubContext = {}): ScrubResult {
  const redactor = new Redactor(input.normalize("NFKC").replace(zeroWidthCharacters, ""));
  for (const username of context.knownUsernames ?? []) {
    const handle = username.replace(/^@/, "").trim();
    if (handle.length >= 2) redactor.apply("username", new RegExp(`@?\\b${escapeForPattern(handle)}\\b`, "gi"));
  }
  for (const { kind, pattern } of personalDataPatterns) {
    const keepsPrefix = pattern.source.startsWith("(\\b(?:order") || pattern.source.startsWith("(^|");
    redactor.apply(kind, pattern, keepsPrefix, kind === "card number" ? passesLuhnCheck : undefined);
  }
  for (const pattern of knownNamePatterns(context.knownNames ?? [])) redactor.apply("name", pattern);
  redactor.apply("name", honorificNamePattern);
  redactor.applyNameAfterLeadIn(greetingNamePattern);
  redactor.applyNameAfterLeadIn(introductionNamePattern);
  redactor.applyNameAfterLeadIn(signOffNamePattern);
  redactor.applyNameAfterLeadIn(namedPersonPattern);
  redactor.text = redactor.text.replace(dashSignaturePattern, (match: string, lineStart: string) => {
    redactor.count += 1;
    redactor.kinds.add("name");
    return `${lineStart}${placeholderFor("name")}`;
  });
  redactor.text = redactor.text.replace(capitalisedPairPattern, (match: string, ...words: unknown[]) => {
    const parts = words.slice(0, 3).filter((word): word is string => typeof word === "string");
    if (parts.some((word) => platformVocabulary.has(word.toLowerCase()))) return match;
    redactor.count += 1;
    redactor.kinds.add("name");
    return placeholderFor("name");
  });
  return { text: collapseRepeatedPlaceholders(redactor.text), redactionCount: redactor.count, redactedKinds: [...redactor.kinds] };
}

function collapseRepeatedPlaceholders(text: string): string {
  return text.replace(/(\[[a-z ]+\])(?:[\s,]*\1)+/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}

const residualChecks: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "email", pattern: /[\p{L}\p{N}._%+-]+\s*@\s*[\p{L}\p{N}-]+\s*\.\s*\p{L}{2,}/u },
  { label: "digits", pattern: /\d(?:[\s().-]*\d){6,}/ },
  { label: "handle", pattern: /(^|\s)@[A-Za-z0-9_.]{2,}/ },
  { label: "money", pattern: /(?:₦|\$|£|€|₵)\s?\d|\b\d[\d,.]*\s?(?:naira|ngn|usd|gbp|eur|ghs|kes|zar)\b/i },
  { label: "link", pattern: /https?:\/\/|www\./i },
  { label: "uuid", pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i },
];

export function findResidualPersonalData(text: string): readonly string[] {
  return residualChecks.filter((check) => check.pattern.test(text)).map((check) => check.label);
}
