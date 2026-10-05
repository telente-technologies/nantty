import { type ChatCryptoStorage, MemoryKeyValueStore } from "@zudomart/chat-crypto";

export const randomBytesFromDevice = (length: number) => crypto.getRandomValues(new Uint8Array(length));

export const createMobileChatCryptoStorage = (): ChatCryptoStorage => ({ secrets: new MemoryKeyValueStore(), records: new MemoryKeyValueStore() });
