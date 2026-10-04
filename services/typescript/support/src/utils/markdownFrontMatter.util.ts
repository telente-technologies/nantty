export interface FrontMatterDocument {
  readonly attributes: Readonly<Record<string, string>>;
  readonly body: string;
}

export function parseFrontMatter(source: string): FrontMatterDocument {
  const normalized = source.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (match === null) return { attributes: {}, body: normalized.trim() };
  const attributes: Record<string, string> = {};
  for (const line of (match[1] ?? "").split("\n")) {
    const separator = line.indexOf(":");
    if (separator > 0) attributes[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { attributes, body: (match[2] ?? "").trim() };
}

export const splitList = (value: string | undefined): string[] => (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
