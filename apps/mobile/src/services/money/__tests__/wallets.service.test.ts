const mockDelete = jest.fn();

jest.mock("../../core/apiClient.service", () => ({ api: { delete: (...args: unknown[]) => mockDelete(...args) }, generateIdempotencyKey: () => "key" }));

import { walletsService as moneyWalletsService } from "../wallets.service";

describe("removing a payout account", () => {
  beforeEach(() => mockDelete.mockReset().mockResolvedValue(undefined));

  it("money service sends the single-use step-up token on DELETE", async () => {
    await moneyWalletsService.removePayoutAccount("pa_1", "step-up-token-1");
    expect(mockDelete).toHaveBeenCalledWith("/api/v1/wallets/me/payout-accounts/pa_1", { headers: { "X-Step-Up-Token": "step-up-token-1" } });
  });
});
