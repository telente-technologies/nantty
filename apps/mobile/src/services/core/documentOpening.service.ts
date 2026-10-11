import type { AttachmentPointer } from "@zudomart/chat-crypto";
import { Directory, File } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { MessageDocument } from "@/types";
import { sanitizeFileNameForDevice } from "@/utils/chatDocument.util";

import { decryptAttachmentInMemory } from "../chatCrypto/encryptedAttachments.service";
import { acquireEphemeralFile, type EphemeralFile, markHandedToOtherApp } from "../chatCrypto/ephemeralDecryptedFiles.service";

const isRemoteUrl = (url: string) => /^https?:\/\//i.test(url);

const extensionOf = (fileName: string) => (fileName.includes(".") ? (fileName.split(".").pop() ?? "") : "");

export const documentFileKey = (mediaId: string) => `document-${mediaId}`;

export async function decryptDocumentToEphemeralFile(mediaId: string, document: MessageDocument, pointer: AttachmentPointer | null): Promise<EphemeralFile> {
  if (!document.url) throw new Error("This file isn't available.");
  if (!isRemoteUrl(document.url)) return { uri: new File(document.url).uri, release: () => undefined };
  if (!pointer) throw new Error("This file can't be opened securely. Ask the sender to send it again.");
  const plaintext = await decryptAttachmentInMemory(mediaId, document.url, pointer);
  return acquireEphemeralFile(documentFileKey(mediaId), plaintext, extensionOf(sanitizeFileNameForDevice(document.fileName)));
}

export async function openChatDocument(mediaId: string, document: MessageDocument, pointer: AttachmentPointer | null): Promise<EphemeralFile> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Opening files isn't supported on this device.");
  const file = await decryptDocumentToEphemeralFile(mediaId, document, pointer);
  markHandedToOtherApp(documentFileKey(mediaId));
  try {
    await Sharing.shareAsync(file.uri, { mimeType: document.mimeType, dialogTitle: document.fileName });
  } catch (error) {
    file.release();
    throw error;
  }
  return file;
}

export async function saveChatDocumentToDevice(mediaId: string, document: MessageDocument, pointer: AttachmentPointer | null): Promise<"saved" | "cancelled"> {
  let chosenFolder: Directory;
  try {
    chosenFolder = await Directory.pickDirectoryAsync();
  } catch {
    return "cancelled";
  }
  const file = await decryptDocumentToEphemeralFile(mediaId, document, pointer);
  try {
    new File(file.uri).copy(new File(chosenFolder, sanitizeFileNameForDevice(document.fileName)));
  } finally {
    file.release();
  }
  return "saved";
}
