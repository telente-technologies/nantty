export const MAXIMUM_CHAT_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const CHAT_DOCUMENT_PICKER_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "jpg", "jpeg", "png", "webp", "heic"];

export interface ChatDocumentKind {
  readonly label: string;
  readonly tone: "red" | "blue" | "green" | "orange" | "grey";
}

const KIND_BY_EXTENSION: Readonly<Record<string, ChatDocumentKind>> = {
  pdf: { label: "PDF", tone: "red" },
  doc: { label: "DOC", tone: "blue" },
  docx: { label: "DOC", tone: "blue" },
  xls: { label: "XLS", tone: "green" },
  xlsx: { label: "XLS", tone: "green" },
  ppt: { label: "PPT", tone: "orange" },
  pptx: { label: "PPT", tone: "orange" },
  txt: { label: "TXT", tone: "grey" },
  zip: { label: "ZIP", tone: "grey" },
  jpg: { label: "IMG", tone: "blue" },
  jpeg: { label: "IMG", tone: "blue" },
  png: { label: "IMG", tone: "blue" },
  webp: { label: "IMG", tone: "blue" },
  heic: { label: "IMG", tone: "blue" },
};

const readExtension = (fileName: string) => fileName.split(".").pop()?.toLowerCase() ?? "";

export const describeDocumentKind = (fileName: string): ChatDocumentKind => KIND_BY_EXTENSION[readExtension(fileName)] ?? { label: "FILE", tone: "grey" };

export const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const buildDocumentSummaryLine = (sizeBytes: number, pageCount?: number | null) =>
  [pageCount ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}` : null, formatFileSize(sizeBytes)].filter(Boolean).join(" · ");

export function findReasonDocumentIsNotAllowed(fileName: string, sizeBytes: number | undefined): string | null {
  if (!ALLOWED_EXTENSIONS.includes(readExtension(fileName))) return "This file type can't be sent. Choose a PDF, Office document, text file, zip or image.";
  if (sizeBytes !== undefined && sizeBytes > MAXIMUM_CHAT_DOCUMENT_BYTES) return `Files can be up to ${MAXIMUM_CHAT_DOCUMENT_BYTES / (1024 * 1024)} MB.`;
  return null;
}

export const sanitizeFileNameForDevice = (fileName: string) => fileName.replace(/[^\w.\- ]+/g, "_");
