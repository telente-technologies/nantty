import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Linking } from "react-native";

import type { MessageDocument } from "@/types";
import { sanitizeFileNameForDevice } from "@/utils/chatDocument.util";

const isRemoteUrl = (url: string) => /^https?:\/\//i.test(url);

async function readDocumentAsLocalFile(document: MessageDocument): Promise<File> {
  if (!document.url) throw new Error("This file isn't available.");
  if (!isRemoteUrl(document.url)) return new File(document.url);
  const downloadFolder = new Directory(Paths.cache, "chatDocuments");
  if (!downloadFolder.exists) downloadFolder.create();
  const destination = new File(downloadFolder, sanitizeFileNameForDevice(document.fileName));
  if (destination.exists) return destination;
  return File.downloadFileAsync(document.url, destination);
}

export async function openChatDocument(document: MessageDocument) {
  if (!(await Sharing.isAvailableAsync())) {
    if (document.url) await Linking.openURL(document.url);
    return;
  }
  const file = await readDocumentAsLocalFile(document);
  await Sharing.shareAsync(file.uri, { mimeType: document.mimeType, dialogTitle: document.fileName });
}

export async function saveChatDocumentToDevice(document: MessageDocument): Promise<"saved" | "cancelled"> {
  const file = await readDocumentAsLocalFile(document);
  let chosenFolder: Directory;
  try {
    chosenFolder = await Directory.pickDirectoryAsync();
  } catch {
    return "cancelled";
  }
  file.copy(new File(chosenFolder, sanitizeFileNameForDevice(document.fileName)));
  return "saved";
}
