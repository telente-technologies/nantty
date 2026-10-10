import { openLocalText, sealedAsyncStorage, sealLocalText } from "../localDataSealing.util";

jest.mock("expo-secure-store", () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0 };
});
jest.mock("expo-crypto", () => ({ getRandomBytes: (length: number) => require("node:crypto").webcrypto.getRandomValues(new Uint8Array(length)) }));

describe("local data sealing", () => {
  it("seals history text with a per-row context and reads legacy plaintext rows", () => {
    const sealed = sealLocalText("meet at 6", "messageHistory:message:m1:text");
    expect(sealed).not.toContain("meet");
    expect(openLocalText(sealed, "messageHistory:message:m1:text")).toBe("meet at 6");
    expect(openLocalText(sealed, "messageHistory:message:m2:text")).toBe("");
    expect(openLocalText("old plaintext row", "messageHistory:message:m1:text")).toBe("old plaintext row");
  });

  it("stores the offline queue sealed and migrates plaintext on the next write", async () => {
    const values = new Map<string, string>([["queue", "{\"legacy\":true}"]]);
    const inner = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => void values.set(key, value), removeItem: async (key: string) => void values.delete(key) };
    const storage = sealedAsyncStorage(inner);
    expect(await storage.getItem("queue")).toBe("{\"legacy\":true}");
    await storage.setItem("queue", "{\"text\":\"secret\"}");
    expect(values.get("queue")).not.toContain("secret");
    expect(await storage.getItem("queue")).toBe("{\"text\":\"secret\"}");
  });
});
