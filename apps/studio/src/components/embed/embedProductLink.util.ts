const uuidAtEnd = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function readProductIdFromNanttyLink(input: string): string | null {
  const text = input.trim();
  if (text === "") return null;
  let path: string;
  try {
    const parsed = new URL(text);
    if (!/(^|\.)(?:nantty|nantty)\.com$/.test(parsed.hostname) && parsed.hostname !== "localhost") return null;
    path = parsed.pathname;
  } catch {
    return /^[A-Za-z0-9_.~-]{1,100}$/.test(text) ? text : null;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments.length !== 2 || !["p", "product"].includes(segments[0] ?? "")) return null;
  const slug = decodeURIComponent(segments[1] ?? "");
  const uuid = uuidAtEnd.exec(slug)?.[1];
  if (uuid !== undefined) return uuid;
  const candidate = slug.slice(slug.lastIndexOf("-") + 1);
  return /^[A-Za-z0-9_.~]{1,100}$/.test(candidate) ? candidate : null;
}
