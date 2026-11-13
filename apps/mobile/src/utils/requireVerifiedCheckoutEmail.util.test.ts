import { ApiError } from "@/errors/api.error";
import { usersService } from "@/services/account/users.service";

import { requireVerifiedCheckoutEmail } from "./requireVerifiedCheckoutEmail.util";

jest.mock("@/services/account/users.service", () => ({ usersService: { fetchMyProfile: jest.fn() } }));

describe("requireVerifiedCheckoutEmail", () => {
  beforeEach(() => jest.mocked(usersService.fetchMyProfile).mockReset());

  it("returns the fresh profile when the account email is verified", async () => {
    const profile = { emailVerified: true, email: "buyer@example.test" };
    jest.mocked(usersService.fetchMyProfile).mockResolvedValue(profile as never);

    await expect(requireVerifiedCheckoutEmail()).resolves.toBe(profile);
  });

  it("rejects an unverified or missing verification state with the payment API code before checkout", async () => {
    jest.mocked(usersService.fetchMyProfile).mockResolvedValue({ emailVerified: false } as never);

    const result = requireVerifiedCheckoutEmail();
    await expect(result).rejects.toMatchObject({ code: "VERIFY_EMAIL_REQUIRED", status: 403 });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
});
