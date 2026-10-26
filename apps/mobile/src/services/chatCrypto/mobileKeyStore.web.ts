import { type ChatCryptoStorage, MemoryKeyValueStore } from "@nantty/chat-crypto";

export const randomBytesFromDevice = (length: number) => crypto.getRandomValues(new Uint8Array(length));

export const createMobileChatCryptoStorage = (): ChatCryptoStorage => ({ secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() });
