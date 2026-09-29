export function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const isPlainNumberOrPhone = /^[+-]?[\d\s().-]+$/.test(text);
  const neutralised = !isPlainNumberOrPhone && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(neutralised) ? `"${neutralised.replace(/"/g, '""')}"` : neutralised;
}

export function convertRowsToCsvText(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export function parseCsvText(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let isInsideQuotes = false;
  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    if (isInsideQuotes) {
      if (character === '"' && csvText[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else if (character === '"') {
        isInsideQuotes = false;
      } else {
        currentCell += character;
      }
      continue;
    }
    if (character === '"') isInsideQuotes = true;
    else if (character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && csvText[index + 1] === "\n") index += 1;
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== "")) rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else currentCell += character;
  }
  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim() !== "")) rows.push(currentRow);
  return rows;
}

export function triggerBrowserDownload(fileName: string, content: Blob | string, mimeType = "text/csv;charset=utf-8"): void {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
