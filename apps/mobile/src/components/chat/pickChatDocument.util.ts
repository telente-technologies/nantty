import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import type { MessageDocument } from "@/types";
import { CHAT_DOCUMENT_PICKER_MIME_TYPES, findReasonDocumentIsNotAllowed } from "@/utils/chatDocument.util";

const PAGE_COUNT_SCAN_LIMIT_BYTES = 20 * 1024 * 1024;
const PDF_PAGE_MARKER = /\/Type\s*\/Page[^s]/g;

async function countPagesInPdf(uri: string, sizeBytes: number): Promise<number | null> {
  if (sizeBytes > PAGE_COUNT_SCAN_LIMIT_BYTES) return null;
  try {
    const bytes = new Uint8Array(await new File(uri).arrayBuffer());
    let text = "";
    for (let start = 0; start < bytes.length; start += 8192) text += String.fromCharCode(...bytes.subarray(start, start + 8192));
    return text.match(PDF_PAGE_MARKER)?.length ?? null;
  } catch {
    return null;
  }
}

export type PickedChatDocument = { readonly status: "picked"; readonly document: MessageDocument } | { readonly status: "cancelled" } | { readonly status: "rejected"; readonly reason: string };

export async function pickDocumentToSendInChat(): Promise<PickedChatDocument> {
  const result = await DocumentPicker.getDocumentAsync({ type: CHAT_DOCUMENT_PICKER_MIME_TYPES, copyToCacheDirectory: true, multiple: false });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return { status: "cancelled" };
  const reason = findReasonDocumentIsNotAllowed(asset.name, asset.size);
  if (reason) return { status: "rejected", reason };
  const sizeBytes = asset.size ?? 0;
  const isPdf = asset.mimeType === "application/pdf" || asset.name.toLowerCase().endsWith(".pdf");
  const pageCount = isPdf ? await countPagesInPdf(asset.uri, sizeBytes) : null;
  return { status: "picked", document: { fileName: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", sizeBytes, pageCount, url: asset.uri } };
}
