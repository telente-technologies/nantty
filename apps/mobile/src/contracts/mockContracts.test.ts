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

describe("taken usernames carry suggestions", () => {
  it("returns up to three valid suggestions from the availability check and the register conflict", async () => {
    const availability = await resolveMockApiRequest<{ available: boolean; suggestions: string[] }>("GET", "/api/v1/auth/username-available?username=taken");
    expect(availability.available).toBe(false);
    expect(availability.suggestions).toHaveLength(3);
    expect(availability.suggestions).not.toContain("taken");
    const failure = await resolveMockApiRequest("POST", "/api/v1/auth/register", { username: "taken", email: "a@b.co" }).catch((error: unknown) => error);
    expect(failure).toMatchObject({ status: 409, code: "USERNAME_TAKEN" });
    expect((failure as ApiError).suggestions).toHaveLength(3);
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
