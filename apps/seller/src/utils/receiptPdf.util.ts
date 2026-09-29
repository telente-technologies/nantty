const pointsPerMillimetre = 72 / 25.4;
const fontSizeInPoints = 8;
const lineHeightInPoints = 10;
const marginInPoints = 10;

function convertTextToPdfSafeAscii(text: string): string {
  return text
    .replace(/[\u00a0\u202f]/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function buildMonospaceReceiptPdf(lines: readonly string[], paperWidthInMillimetres: number): Blob {
  const pageWidth = Math.round(paperWidthInMillimetres * pointsPerMillimetre);
  const pageHeight = Math.max(200, marginInPoints * 2 + lines.length * lineHeightInPoints);
  const textCommands = lines.map((line, index) => `1 0 0 1 ${marginInPoints} ${pageHeight - marginInPoints - fontSizeInPoints - index * lineHeightInPoints} Tm (${convertTextToPdfSafeAscii(line)}) Tj`).join("\n");
  const contentStream = `BT\n/F1 ${fontSizeInPoints} Tf\n${textCommands}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
  ];
  let pdfText = "%PDF-1.4\n";
  const objectOffsets: number[] = [];
  objects.forEach((objectBody, index) => {
    objectOffsets.push(pdfText.length);
    pdfText += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });
  const crossReferenceOffset = pdfText.length;
  pdfText += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${objectOffsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`;
  return new Blob([pdfText], { type: "application/pdf" });
}
