function normalizePathForInspection(rawPath: string): string[] {
  let decoded = rawPath;
  for (let round = 0; round < 3; round += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return ["internal"];
    }
  }
  const segments: string[] = [];
  for (const segment of decoded.toLowerCase().replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment.trim());
  }
  return segments;
}

export function isInternalOnlyPath(rawPath: string): boolean {
  return normalizePathForInspection(rawPath).some((segment) => segment === "internal" || segment.startsWith("internal;"));
}
