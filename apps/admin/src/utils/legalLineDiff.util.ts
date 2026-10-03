export type LegalDiffRowKind = "same" | "added" | "removed" | "changed";

export interface LegalDiffRow {
  readonly kind: LegalDiffRowKind;
  readonly leftText: string | null;
  readonly rightText: string | null;
}

function buildLongestCommonSubsequenceTable(leftLines: readonly string[], rightLines: readonly string[]): number[][] {
  const table = Array.from({ length: leftLines.length + 1 }, () => new Array<number>(rightLines.length + 1).fill(0));
  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      const row = table[leftIndex] as number[];
      row[rightIndex] = leftLines[leftIndex] === rightLines[rightIndex] ? (table[leftIndex + 1] as number[])[rightIndex + 1]! + 1 : Math.max((table[leftIndex + 1] as number[])[rightIndex]!, row[rightIndex + 1]!);
    }
  }
  return table;
}

export function buildSideBySideLineDiff(leftText: string, rightText: string): LegalDiffRow[] {
  const leftLines = leftText.split("\n");
  const rightLines = rightText.split("\n");
  const table = buildLongestCommonSubsequenceTable(leftLines, rightLines);
  const rows: LegalDiffRow[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftLines.length || rightIndex < rightLines.length) {
    const leftLine = leftLines[leftIndex];
    const rightLine = rightLines[rightIndex];
    if (leftLine !== undefined && leftLine === rightLine) {
      rows.push({ kind: "same", leftText: leftLine, rightText: rightLine });
      leftIndex += 1;
      rightIndex += 1;
    } else if (rightLine === undefined || (leftLine !== undefined && (table[leftIndex + 1] as number[])[rightIndex]! >= (table[leftIndex] as number[])[rightIndex + 1]!)) {
      rows.push({ kind: "removed", leftText: leftLine ?? "", rightText: null });
      leftIndex += 1;
    } else {
      rows.push({ kind: "added", leftText: null, rightText: rightLine });
      rightIndex += 1;
    }
  }
  return pairRemovedWithAddedAsChanged(rows);
}

function pairRemovedWithAddedAsChanged(rows: readonly LegalDiffRow[]): LegalDiffRow[] {
  const paired: LegalDiffRow[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index] as LegalDiffRow;
    const next = rows[index + 1];
    if (row.kind === "removed" && next?.kind === "added") {
      paired.push({ kind: "changed", leftText: row.leftText, rightText: next.rightText });
      index += 2;
    } else {
      paired.push(row);
      index += 1;
    }
  }
  return paired;
}
