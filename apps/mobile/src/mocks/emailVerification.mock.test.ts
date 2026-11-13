import { ApiError } from "@/errors/api.error";

import { resolveMockApiRequest } from ".";
import { mockSession } from "./fixtures.mock";
import { applyProfileEditForSignedInUser } from "./users.mock";

const path = "/api/v1/users/me/email/verification";
const confirmPath = `${path}/confirm`;

describe("mock email verification routes", () => {
  beforeEach(() => {
    mockSession.signedInUserId = "u_me";
    applyProfileEditForSignedInUser({ emailVerified: false });
  });

  it("issues a code, rejects an incorrect code, then marks the profile verified", async () => {
    await expect(resolveMockApiRequest("POST", path, undefined)).resolves.toEqual({ expiresIn: 600, resendAfterSeconds: 60 });
    await expect(resolveMockApiRequest("POST", confirmPath, { code: "000000" })).rejects.toMatchObject({ code: "INVALID_CODE" });
    await expect(resolveMockApiRequest("POST", confirmPath, { code: "123456" })).resolves.toEqual({ email: "testnantty@yahoo.com", emailVerified: true });
    await expect(resolveMockApiRequest("GET", "/api/v1/users/me", undefined)).resolves.toMatchObject({ emailVerified: true });
  });

  it("rejects code confirmation until a code was requested", async () => {
    const result = resolveMockApiRequest("POST", confirmPath, { code: "123456" });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ code: "CODE_NOT_SENT" });
  });
});
