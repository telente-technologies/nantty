export const productOptionLimits = { maxGroups: 3, maxValuesPerGroup: 30, maxValueBytes: 40, maxNameBytes: 30, maxVariants: 100 } as const;
export const optionNameSuggestions = ["Size", "Colour", "Storage", "Material"] as const;

export interface OptionValuesAddResult {
  readonly values: string[];
  readonly added: string[];
  readonly error: string | null;
}

export function measureUtf8Bytes(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

const normaliseOptionText = (value: string) => value.trim().toLocaleLowerCase();

export function isSameOptionText(left: string, right: string): boolean {
  return normaliseOptionText(left) === normaliseOptionText(right);
}

export function splitPastedOptionValues(text: string): string[] {
  return text.split(/[,\n;\t]/).map((part) => part.trim()).filter(Boolean);
}

function shortenForMessage(value: string): string {
  const characters = [...value];
  return characters.length > 20 ? `${characters.slice(0, 20).join("")}…` : value;
}

export function addOptionValues(current: readonly string[], rawText: string): OptionValuesAddResult {
  const candidates = splitPastedOptionValues(rawText);
  const values = [...current];
  const added: string[] = [];
  const duplicates: string[] = [];
  const tooLong: string[] = [];
  let leftOut = 0;
  for (const candidate of candidates) {
    if (measureUtf8Bytes(candidate) > productOptionLimits.maxValueBytes) tooLong.push(candidate);
    else if (values.some((value) => isSameOptionText(value, candidate))) duplicates.push(candidate);
    else if (values.length >= productOptionLimits.maxValuesPerGroup) leftOut += 1;
    else {
      values.push(candidate);
      added.push(candidate);
    }
  }
  const error = candidates.length === 0
    ? "Type a value first."
    : leftOut > 0
      ? `An option can have up to ${productOptionLimits.maxValuesPerGroup} values.${leftOut > 1 ? ` ${leftOut} were left out.` : ""}`
      : tooLong.length > 0
        ? `“${shortenForMessage(tooLong[0]!)}” is too long. Keep values short, like “Large” or “128GB”.`
        : duplicates.length > 0
          ? `“${duplicates[0]}” is already added.`
          : null;
  return { values, added, error };
}

export function moveOptionValue(values: readonly string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= values.length || toIndex >= values.length) return [...values];
  const next = [...values];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

export interface OptionGroupLike {
  readonly key: string;
  readonly name: string;
  readonly values: readonly string[];
  readonly pendingText: string;
}

export function describeOptionGroupProblem(group: OptionGroupLike, groups: readonly OptionGroupLike[]): string | null {
  const name = group.name.trim();
  if (name.length === 0) return group.values.length > 0 ? "Give this option a name, like Size." : null;
  if (measureUtf8Bytes(name) > productOptionLimits.maxNameBytes) return "Keep the option name under 30 characters.";
  if (groups.some((other) => other.key !== group.key && isSameOptionText(other.name, name))) return `You already have an option called ${name}.`;
  if (group.pendingText.trim().length > 0) return `Press Enter or Add to keep “${shortenForMessage(group.pendingText.trim())}”, or clear it.`;
  if (group.values.length === 0) return `Add at least one ${name.toLocaleLowerCase()}, or remove this option.`;
  return null;
}

export function countOptionCombinations(groups: readonly OptionGroupLike[]): number {
  return groups.filter((group) => group.name.trim() && group.values.length > 0).reduce((total, group) => total * group.values.length, 1);
}
