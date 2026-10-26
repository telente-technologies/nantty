import { decodeBase64 } from "@nantty/chat-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { AppState, type AppStateStatus, Platform } from "react-native";

import { registerSignOutHook } from "@/store/auth.store";

import { forgetDecryptedAttachmentsInMemory } from "./encryptedAttachments.service";

export interface EphemeralFile {
  readonly uri: string;
  readonly release: () => void;
}

const folderName = "zm-decrypted";
const legacyFolderNames = ["chatDocuments"];
const legacyFilePrefix = "zm-attachment-";

const holders = new Map<string, { file: File; count: number }>();
const handedToOtherApps = new Set<string>();
const wipeListeners = new Set<() => void>();

const folder = () => new Directory(Paths.cache, folderName);

function deleteQuietly(target: File | Directory) {
  try {
    if (target.exists) target.delete();
  } catch {
    return;
  }
}

const safeName = (key: string, extension: string) => `${key.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80)}${extension ? `.${extension.replace(/[^A-Za-z0-9]/g, "").slice(0, 8)}` : ""}`;

export function acquireEphemeralFile(key: string, plaintext: Uint8Array, extension: string): EphemeralFile {
  if (Platform.OS === "web") throw new Error("EPHEMERAL_FILES_UNSUPPORTED");
  let held = holders.get(key);
  if (!held || !held.file.exists) {
    const directory = folder();
    if (!directory.exists) directory.create({ intermediates: true });
    const file = new File(directory, safeName(key, extension));
    deleteQuietly(file);
    file.create();
    file.write(plaintext);
    held = { file, count: 0 };
    holders.set(key, held);
  }
  held.count += 1;
  let released = false;
  return {
    uri: held.file.uri,
    release: () => {
      if (released) return;
      released = true;
      const current = holders.get(key);
      if (!current) return;
      current.count -= 1;
      if (current.count > 0 || handedToOtherApps.has(key)) return;
      holders.delete(key);
      deleteQuietly(current.file);
    },
  };
}

export const markHandedToOtherApp = (key: string) => void handedToOtherApps.add(key);

export function wipeDecryptedFiles(options: { readonly keepHandedToOtherApps?: boolean } = {}) {
  if (Platform.OS === "web") return;
  for (const [key, held] of [...holders]) {
    if (options.keepHandedToOtherApps && handedToOtherApps.has(key)) continue;
    holders.delete(key);
    handedToOtherApps.delete(key);
    deleteQuietly(held.file);
  }
  if (holders.size === 0) {
    deleteQuietly(folder());
    for (const name of legacyFolderNames) deleteQuietly(new Directory(Paths.cache, name));
    try {
      for (const entry of new Directory(Paths.cache).list()) if (entry instanceof File && entry.name.startsWith(legacyFilePrefix)) deleteQuietly(entry);
    } catch {
      // the cache folder can't be listed; the named folders above are already gone
    }
  }
  wipeListeners.forEach((listener) => listener());
}

function wipeFilesHandedToOtherApps() {
  for (const key of [...handedToOtherApps]) {
    handedToOtherApps.delete(key);
    const held = holders.get(key);
    if (held && held.count <= 0) {
      holders.delete(key);
      deleteQuietly(held.file);
    }
  }
}

export function subscribeToDecryptedFileWipes(listener: () => void) {
  wipeListeners.add(listener);
  return () => void wipeListeners.delete(listener);
}

export function handleAppStateForDecryptedFiles(state: AppStateStatus) {
  if (state === "background") wipeDecryptedFiles({ keepHandedToOtherApps: true });
  else if (state === "active") wipeFilesHandedToOtherApps();
}

let started = false;

export function startDecryptedMediaHygiene() {
  if (started) return;
  started = true;
  wipeDecryptedFiles();
  AppState.addEventListener("change", handleAppStateForDecryptedFiles);
  registerSignOutHook(async () => {
    forgetDecryptedAttachmentsInMemory();
    wipeDecryptedFiles();
  });
}

const dataUriPattern = /^data:([^;,]+);base64,(.*)$/s;

export function playableSourceForVoiceNote(mediaId: string, url: string | null, platform: string = Platform.OS): { readonly uri: string; readonly file: EphemeralFile | null } | null {
  if (!url) return null;
  const match = dataUriPattern.exec(url);
  if (!match || platform === "web") return { uri: url, file: null };
  const file = acquireEphemeralFile(`voice-${mediaId}`, decodeBase64(match[2]!), match[1]!.split("/")[1] ?? "m4a");
  return { uri: file.uri, file };
}
