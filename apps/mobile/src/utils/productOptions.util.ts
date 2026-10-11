export const PRODUCT_OPTION_LIMITS = { maxGroups: 3, maxValuesPerGroup: 30, maxValueBytes: 40, maxNameBytes: 30, maxVariants: 100 } as const;
export const OPTION_NAME_SUGGESTIONS = ["Size", "Colour", "Storage", "Material"] as const;

export interface OptionGroupDraft {
  readonly key: string;
  readonly name: string;
  readonly values: readonly string[];
  readonly pendingText: string;
  readonly originalName: string | null;
}

export interface OptionValuesAddResult {
  readonly values: string[];
  readonly added: string[];
  readonly error: string | null;
}

let optionGroupCounter = 0;
export function createOptionGroupKey(): string {
  optionGroupCounter += 1;
  return `option_${optionGroupCounter}`;
}

export function createOptionGroupDraft(name: string, values: readonly string[] = [], originalName: string | null = null): OptionGroupDraft {
  return { key: createOptionGroupKey(), name, values: [...values], pendingText: "", originalName };
}

export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

const normalise = (value: string) => value.trim().toLocaleLowerCase();

export function splitPastedOptionValues(text: string): string[] {
  return text.split(/[,\n;]/).map((part) => part.trim()).filter(Boolean);
}

export function addOptionValues(current: readonly string[], rawText: string): OptionValuesAddResult {
  const candidates = splitPastedOptionValues(rawText);
  const values = [...current];
  const added: string[] = [];
  const duplicates: string[] = [];
  const tooLong: string[] = [];
  let overCap = 0;
  for (const candidate of candidates) {
    if (utf8ByteLength(candidate) > PRODUCT_OPTION_LIMITS.maxValueBytes) tooLong.push(candidate);
    else if (values.some((value) => normalise(value) === normalise(candidate))) duplicates.push(candidate);
    else if (values.length >= PRODUCT_OPTION_LIMITS.maxValuesPerGroup) overCap += 1;
    else {
      values.push(candidate);
      added.push(candidate);
    }
  }
  const error = candidates.length === 0
    ? "Type a value first."
    : overCap > 0
      ? `An option can have up to ${PRODUCT_OPTION_LIMITS.maxValuesPerGroup} values.${overCap > 1 ? ` ${overCap} were left out.` : ""}`
      : tooLong.length > 0
        ? `“${truncateForMessage(tooLong[0]!)}” is too long. Keep values short, like “Large” or “128GB”.`
        : duplicates.length > 0
          ? `“${duplicates[0]}” is already added.`
          : null;
  return { values, added, error };
}

function truncateForMessage(value: string): string {
  const characters = [...value];
  return characters.length > 20 ? `${characters.slice(0, 20).join("")}…` : value;
}

export function moveOptionValue(values: readonly string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= values.length || toIndex >= values.length) return [...values];
  const next = [...values];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

export function usableOptionGroups(groups: readonly OptionGroupDraft[]): { name: string; values: string[] }[] {
  return groups.map((group) => ({ name: group.name.trim(), values: [...group.values] })).filter((group) => group.name.length > 0 && group.values.length > 0);
}

export function countVariantCombinations(groups: readonly OptionGroupDraft[]): number {
  return usableOptionGroups(groups).reduce((total, group) => total * group.values.length, 1);
}

export function optionValueCombinations(options: readonly { readonly name: string; readonly values: readonly string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>((rows, option) => rows.flatMap((row) => option.values.map((value) => ({ ...row, [option.name]: value }))), [{}]);
}

export function describeOptionGroupError(group: OptionGroupDraft, groups: readonly OptionGroupDraft[]): string | null {
  const name = group.name.trim();
  if (name.length === 0) return group.values.length > 0 ? "Give this option a name, like Size." : null;
  if (utf8ByteLength(name) > PRODUCT_OPTION_LIMITS.maxNameBytes) return "Keep the option name under 30 characters.";
  if (groups.some((other) => other.key !== group.key && normalise(other.name) === normalise(name))) return `You already have an option called ${name}.`;
  if (group.pendingText.trim().length > 0) return `Tap Add to keep “${truncateForMessage(group.pendingText.trim())}”, or clear it.`;
  if (group.values.length === 0) return `Add at least one ${name.toLocaleLowerCase()}, or remove this option.`;
  return null;
}

export function validateOptionGroups(groups: readonly OptionGroupDraft[]): string | null {
  if (groups.length > PRODUCT_OPTION_LIMITS.maxGroups) return "A product can have up to 3 options, like size, colour and one more.";
  for (const group of groups) {
    const message = describeOptionGroupError(group, groups);
    if (message) return message;
  }
  if (countVariantCombinations(groups) > PRODUCT_OPTION_LIMITS.maxVariants) return `These options make ${countVariantCombinations(groups)} variants. The limit is ${PRODUCT_OPTION_LIMITS.maxVariants}, so remove a few values.`;
  return null;
}

export interface ExistingVariantLike {
  readonly id: string;
  readonly optionValues: Readonly<Record<string, string>>;
}

export function projectExistingVariantsOntoOptions<T extends ExistingVariantLike>(existing: readonly T[], groups: readonly OptionGroupDraft[]): Map<string, T> {
  const options = groups.filter((group) => group.name.trim().length > 0 && group.values.length > 0);
  const projected = new Map<string, T>();
  for (const variant of existing) {
    const values: string[] = [];
    for (const group of options) {
      const kept = group.originalName === null ? undefined : variant.optionValues[group.originalName];
      const value = kept ?? (group.originalName === null ? group.values[0] : undefined);
      if (value === undefined || !group.values.includes(value)) break;
      values.push(value);
    }
    if (values.length !== options.length) continue;
    const combinationKey = values.join("\u0000");
    if (!projected.has(combinationKey)) projected.set(combinationKey, variant);
  }
  return projected;
}

export function combinationKeyFor(optionValues: Readonly<Record<string, string>>, groups: readonly OptionGroupDraft[]): string {
  return usableOptionGroups(groups).map((group) => optionValues[group.name] ?? "").join("\u0000");
}
