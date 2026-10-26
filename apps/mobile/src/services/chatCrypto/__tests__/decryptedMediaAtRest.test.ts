const mockDisk = new Map<string, Uint8Array>();
const mockAppStateListeners: ((state: string) => void)[] = [];
const mockSignOutHooks: (() => Promise<void>)[] = [];

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  AppState: { currentState: "active", addEventListener: (_event: string, listener: (state: string) => void) => mockAppStateListeners.push(listener) },
}));
jest.mock("@/store/auth.store", () => ({ registerSignOutHook: (hook: () => Promise<void>) => mockSignOutHooks.push(hook) }));
jest.mock("@/services/chatCrypto/mobileKeyStore", () => ({ randomBytesFromDevice: (length: number) => new Uint8Array(length).fill(9) }));
jest.mock("@/services/media/mediaUploadTransport.service", () => ({ mediaUploadTransport: {} }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock("expo-file-system", () => {
  const join = (parts: unknown[]) => parts.map((part) => (typeof part === "string" ? part : (part as { uri: string }).uri)).join("/");
  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get name() { return this.uri.split("/").pop() ?? ""; }
    get exists() { return mockDisk.has(this.uri); }
    create() { mockDisk.set(this.uri, new Uint8Array()); }
    write(bytes: Uint8Array) { mockDisk.set(this.uri, bytes); }
    delete() { mockDisk.delete(this.uri); }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return mockDisk.has(`${this.uri}/`) || [...mockDisk.keys()].some((key) => key.startsWith(`${this.uri}/`)); }
    create() { mockDisk.set(`${this.uri}/`, new Uint8Array()); }
    delete() { for (const key of [...mockDisk.keys()]) if (key.startsWith(`${this.uri}/`)) mockDisk.delete(key); }
    list() { return [...mockDisk.keys()].filter((key) => key.startsWith(`${this.uri}/`) && !key.slice(this.uri.length + 1).includes("/") && key !== `${this.uri}/`).map((key) => new File(key)); }
  }
  return { File, Directory, Paths: { cache: "cache" } };
});

import { encryptAttachment } from "@nantty/chat-crypto";

import { decryptionStrategyFor } from "@/components/chat/decryptedMedia.hook";

import { decryptAttachmentInMemory, forgetDecryptedAttachmentsInMemory, resolveDecryptedImageInMemory } from "../encryptedAttachments.service";
import { acquireEphemeralFile, markHandedToOtherApp, playableSourceForVoiceNote, startDecryptedMediaHygiene, subscribeToDecryptedFileWipes } from "../ephemeralDecryptedFiles.service";


const random = (length: number) => new Uint8Array(length).map((_, index) => (index * 31 + 7) % 256);
const plaintext = new TextEncoder().encode("secret family photo bytes");
const sealed = encryptAttachment(plaintext, { contentType: "image/jpeg" }, random);
const plaintextFilesOnDisk = () => [...mockDisk.entries()].filter(([, bytes]) => Buffer.from(bytes).includes(Buffer.from("secret")));

beforeAll(() => startDecryptedMediaHygiene());
beforeEach(() => {
  forgetDecryptedAttachmentsInMemory();
  for (const key of [...mockDisk.keys()]) mockDisk.delete(key);
});

describe("decrypted chat media never rests on mockDisk longer than needed", () => {
  it("decrypts images and voice notes in memory without writing a file", async () => {
    const download = jest.fn(async () => sealed.blob.slice().buffer as ArrayBuffer);
    const uri = await resolveDecryptedImageInMemory("m1", "https://media/m1", sealed.pointer, download);
    expect(uri.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(Buffer.from(await decryptAttachmentInMemory("m1", "https://media/m1", sealed.pointer, download)).toString()).toBe("secret family photo bytes");
    expect(download).toHaveBeenCalledTimes(1);
    expect(mockDisk.size).toBe(0);
    expect(decryptionStrategyFor({ kind: "image", media: { id: "m1", type: "image", url: null } })).toBe("memory");
    expect(decryptionStrategyFor({ kind: "voice", media: { id: "m2", type: "voice", url: null } })).toBe("memory");
    expect(decryptionStrategyFor({ kind: "text", media: { id: "m3", type: "video", url: null } })).toBe("file");
    expect(decryptionStrategyFor({ kind: "document", media: null, document: { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1, pageCount: null, url: "https://x" } })).toBe("onOpen");
  });

  it("rejects a tampered blob instead of showing it", async () => {
    const tampered = sealed.blob.slice();
    tampered[tampered.length - 1] ^= 1;
    await expect(decryptAttachmentInMemory("m9", "https://media/m9", sealed.pointer, async () => tampered.buffer as ArrayBuffer)).rejects.toThrow();
  });

  it("deletes a file-backed media file when its last viewer unmounts", () => {
    const first = acquireEphemeralFile("video-1", plaintext, "mp4");
    const second = acquireEphemeralFile("video-1", plaintext, "mp4");
    expect(first.uri).toBe(second.uri);
    first.release();
    first.release();
    expect(plaintextFilesOnDisk()).toHaveLength(1);
    second.release();
    expect(plaintextFilesOnDisk()).toHaveLength(0);
  });

  it("wipes every decrypted file when the app goes to the background and tells viewers to reload", () => {
    const listener = jest.fn();
    const stop = subscribeToDecryptedFileWipes(listener);
    acquireEphemeralFile("video-2", plaintext, "mp4");
    mockAppStateListeners.forEach((notify) => notify("background"));
    expect(plaintextFilesOnDisk()).toHaveLength(0);
    expect(listener).toHaveBeenCalled();
    stop();
  });

  it("keeps a document handed to another app until we return to the foreground", () => {
    const opened = acquireEphemeralFile("document-d1", plaintext, "pdf");
    markHandedToOtherApp("document-d1");
    opened.release();
    mockAppStateListeners.forEach((notify) => notify("background"));
    expect(plaintextFilesOnDisk()).toHaveLength(1);
    mockAppStateListeners.forEach((notify) => notify("active"));
    expect(plaintextFilesOnDisk()).toHaveLength(0);
  });

  it("sweeps leftovers from earlier versions and on sign-out", async () => {
    mockDisk.set("cache/zm-attachment-old", plaintext);
    mockDisk.set("cache/chatDocuments/invoice.pdf", plaintext);
    mockDisk.set("cache/zm-decrypted/stale.jpg", plaintext);
    await Promise.all(mockSignOutHooks.map((hook) => hook()));
    expect(plaintextFilesOnDisk()).toHaveLength(0);
  });

  it("only writes a voice note to mockDisk while it is playing", () => {
    const dataUri = `data:audio/mp4;base64,${Buffer.from(plaintext).toString("base64")}`;
    expect(mockDisk.size).toBe(0);
    const source = playableSourceForVoiceNote("v1", dataUri, "ios");
    expect(source?.file).not.toBeNull();
    expect(plaintextFilesOnDisk()).toHaveLength(1);
    source?.file?.release();
    expect(plaintextFilesOnDisk()).toHaveLength(0);
    expect(playableSourceForVoiceNote("v1", "file:///my-recording.m4a", "ios")).toEqual({ uri: "file:///my-recording.m4a", file: null });
  });
});
