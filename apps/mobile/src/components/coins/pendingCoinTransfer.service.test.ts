import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@/utils/secureStorage.util", () => ({
  secureStorage: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

import { secureStorage } from "@/utils/secureStorage.util";
import { clearPendingCoinTransfer, readPendingCoinTransfer, savePendingCoinTransfer } from "./pendingCoinTransfer.service";

const mockGet = jest.mocked(secureStorage.get);
const mockSet = jest.mocked(secureStorage.set);
const mockRemove = jest.mocked(secureStorage.remove);

describe("pending coin transfer storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores and restores the exact account-scoped operation", async () => {
    const attempt = {
      accountId: "account-a",
      idempotencyKey: "transfer-key-123456",
      recipientUserId: "recipient-b",
      coins: 250,
      feeBasisPoints: 200,
      feeCoins: 5,
      netCoins: 245,
    };
    await savePendingCoinTransfer(attempt);
    mockGet.mockResolvedValueOnce(JSON.stringify(attempt));
    await expect(readPendingCoinTransfer("account-a")).resolves.toEqual(attempt);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockSet.mock.calls[0]?.[0]).toEqual(mockGet.mock.calls[0]?.[0]);
  });

  it("refuses to restore an operation under a different signed-in account", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({
      accountId: "account-a",
      idempotencyKey: "transfer-key-123456",
      recipientUserId: "recipient-b",
      coins: 250,
      feeBasisPoints: 200,
      feeCoins: 5,
      netCoins: 245,
    }));
    await expect(readPendingCoinTransfer("account-b")).rejects.toThrow("saved coin transfer is invalid");
  });

  it("clears a settled pending intent from secure storage", async () => {
    await clearPendingCoinTransfer("account-a");
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
