const mockDelete = jest.fn();

jest.mock("../../core/apiClient.service", () => ({ api: { delete: (...args: unknown[]) => mockDelete(...args) }, generateIdempotencyKey: () => "key" }));
jest.mock("../../apiClient.service", () => ({ api: { delete: (...args: unknown[]) => mockDelete(...args) }, generateIdempotencyKey: () => "key" }));

import { walletsService as moneyWalletsService } from "../wallets.service";
import { walletsService as legacyWalletsService } from "../../wallets.service";

describe("removing a payout account", () => {
  beforeEach(() => mockDelete.mockReset().mockResolvedValue(undefined));

  it.each([["money", moneyWalletsService], ["legacy", legacyWalletsService]])("%s service sends the single-use step-up token on DELETE", async (_name, service) => {
    await service.removePayoutAccount("pa_1", "step-up-token-1");
    expect(mockDelete).toHaveBeenCalledWith("/api/v1/wallets/me/payout-accounts/pa_1", { headers: { "X-Step-Up-Token": "step-up-token-1" } });
  });
});
