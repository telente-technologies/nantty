import { ApiError } from "@/errors/api.error";
import { resolveMockApiRequest } from "@/mocks";
import { toPageEnvelope, unwrapApiPayload } from "@/services/apiClient.service";

import { validateAgainstContract } from "./contractSchema.util";
import { identityContracts } from "./identity.contract";

describe("mock responses match the client contracts", () => {
  it.each(identityContracts.map((contract) => [`${contract.domain} ${contract.method} ${contract.path}`, contract] as const))("%s", async (_name, contract) => {
    const payload = await resolveMockApiRequest<unknown>(contract.method, contract.path, contract.body);
    expect(validateAgainstContract(contract.schema, payload)).toEqual([]);
  });

  it.each([
    ["taken", 409, "USERNAME_TAKEN"],
    ["admin", 422, "USERNAME_UNAVAILABLE"],
    ["a!", 422, "USERNAME_INVALID"],
  ])("username change with %s fails with %s", async (username, status, code) => {
    const failure = await resolveMockApiRequest("PATCH", "/api/v1/users/me/username", { username }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status, code });
  });
});

describe("list envelope handling", () => {
  it("keeps nextCursor for page envelopes and unwraps single resources", () => {
    expect(unwrapApiPayload({ data: [1], nextCursor: "c2" })).toEqual({ data: [1], nextCursor: "c2" });
    expect(unwrapApiPayload({ data: { id: "a" } })).toEqual({ id: "a" });
    expect(unwrapApiPayload({ id: "a" })).toEqual({ id: "a" });
  });

  it("normalises bare arrays and envelopes into pages", () => {
    expect(toPageEnvelope([1, 2])).toEqual({ data: [1, 2], nextCursor: null });
    expect(toPageEnvelope({ data: [1], nextCursor: "x" })).toEqual({ data: [1], nextCursor: "x" });
  });
});
