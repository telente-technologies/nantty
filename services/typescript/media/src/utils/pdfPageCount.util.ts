export function countPdfPages(content: Uint8Array): number | undefined {
  const text = Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString("latin1");
  if (!text.startsWith("%PDF-") || !text.includes("%%EOF")) return undefined;
  const declared = [...text.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((match) => Number(match[1]));
  if (declared.length > 0) return Math.max(...declared);
  const leafPages = text.match(/\/Type\s*\/Page(?![A-Za-z])/g);
  return leafPages === null ? undefined : leafPages.length;
}

export function pdfContainsActiveContent(content: Uint8Array): boolean {
  const text = Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString("latin1");
  return /\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(text);
}
