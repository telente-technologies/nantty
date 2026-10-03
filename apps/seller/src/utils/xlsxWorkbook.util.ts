import { buildStoredZipArchive } from "@/utils/zipArchive.util";

export type SpreadsheetCellValue = string | number | null;

export interface SpreadsheetSheet {
  readonly name: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly SpreadsheetCellValue[])[];
  readonly boldLastRow?: boolean;
}

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXmlText(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function convertColumnIndexToLetters(columnIndex: number): string {
  let letters = "";
  let remaining = columnIndex + 1;
  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

function buildCellXml(value: SpreadsheetCellValue, reference: string, styleIndex: number): string {
  const styleAttribute = styleIndex > 0 ? ` s="${styleIndex}"` : "";
  if (value === null || value === "") return `<c r="${reference}"${styleAttribute}/>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${escapeXmlText(String(value))}</t></is></c>`;
}

function buildWorksheetXml(sheet: SpreadsheetSheet): string {
  const everyRow = [sheet.headers, ...sheet.rows];
  const rowsXml = everyRow
    .map((row, rowIndex) => {
      const isBold = rowIndex === 0 || (sheet.boldLastRow === true && rowIndex === everyRow.length - 1);
      const cellsXml = row.map((value, columnIndex) => buildCellXml(value, `${convertColumnIndexToLetters(columnIndex)}${rowIndex + 1}`, isBold ? 1 : 0)).join("");
      return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
    })
    .join("");
  const columnsXml = sheet.headers.map((header, columnIndex) => `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${Math.min(48, Math.max(12, header.length + 4))}" customWidth="1"/>`).join("");
  return `${xmlDeclaration}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columnsXml}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
}

function sanitiseSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

export function buildXlsxWorkbookBytes(sheets: readonly SpreadsheetSheet[]): Uint8Array {
  const encoder = new TextEncoder();
  const sheetEntries = sheets.map((sheet, index) => ({ path: `xl/worksheets/sheet${index + 1}.xml`, content: encoder.encode(buildWorksheetXml(sheet)) }));
  const contentTypes = `${xmlDeclaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  const rootRelationships = `${xmlDeclaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `${xmlDeclaration}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXmlText(sanitiseSheetName(sheet.name, index))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`;
  const workbookRelationships = `${xmlDeclaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `${xmlDeclaration}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return buildStoredZipArchive([
    { path: "[Content_Types].xml", content: encoder.encode(contentTypes) },
    { path: "_rels/.rels", content: encoder.encode(rootRelationships) },
    { path: "xl/workbook.xml", content: encoder.encode(workbook) },
    { path: "xl/_rels/workbook.xml.rels", content: encoder.encode(workbookRelationships) },
    { path: "xl/styles.xml", content: encoder.encode(styles) },
    ...sheetEntries,
  ]);
}

export const xlsxMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function createXlsxBlob(sheets: readonly SpreadsheetSheet[]): Blob {
  const bytes = buildXlsxWorkbookBytes(sheets);
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: xlsxMimeType });
}
