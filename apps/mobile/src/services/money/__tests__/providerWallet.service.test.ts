const mockGet = jest.fn();

jest.mock("../../core/apiClient.service", () => ({ api: { get: (...args: unknown[]) => mockGet(...args), post: jest.fn() } }));

import { providerWalletService } from "../providerWallet.service";

describe("provider wallet read", () => {
  beforeEach(() => mockGet.mockReset());

  it("treats a wallet that is not provisioned yet as missing, not as an error", async () => {
    mockGet.mockResolvedValue({ wallet: null, status: "not_ready" });
    await expect(providerWalletService.fetchMyWallet()).resolves.toBeNull();
    expect(mockGet).toHaveBeenCalledWith("/api/v1/payments/wallet/me");
  });

  it("returns the wallet once it exists", async () => {
    const wallet = { wallet: { status: "active", accountNumber: "8571234567" }, balances: { currency: "NGN", availableMinor: 0 } };
    mockGet.mockResolvedValue(wallet);
    await expect(providerWalletService.fetchMyWallet()).resolves.toBe(wallet);
  });
});
