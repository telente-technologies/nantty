import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, logInUser, registerUser, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi } from "../src/apiClient.util.js";
import { writeSmokeReport } from "../src/smokeReport.util.js";

interface FrontendContract {
  readonly domain: string;
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
  readonly schema: unknown;
}

type Validator = (schema: unknown, value: unknown) => string[];

interface ContractOutcome {
  readonly app: string;
  readonly method: string;
  readonly path: string;
  readonly status: number | "skipped";
  readonly problems: readonly string[];
}

const appsRoot = resolve(import.meta.dirname, "../../../../apps");
const mockOnlyIds = /\/(live_\w+|post_\w+|user_\w+)(\/|$)/;
const socialSignIn = /\/auth\/(google|apple)$/;

async function loadAppContracts(app: string, file: string, exportName: string): Promise<{ contracts: readonly FrontendContract[]; validate: Validator; c: Record<string, (...args: never[]) => unknown> }> {
  const contractModule = (await import(pathToFileURL(resolve(appsRoot, app, "src/contracts", file)).href)) as Record<string, unknown>;
  const schemaModule = (await import(pathToFileURL(resolve(appsRoot, app, "src/contracts/contractSchema.util.ts")).href)) as { validateAgainstContract: Validator; c: Record<string, (...args: never[]) => unknown> };
  return { contracts: contractModule[exportName] as readonly FrontendContract[], validate: schemaModule.validateAgainstContract, c: schemaModule.c };
}

const fakeProviderToken = "header.payload.signature-for-contract-check";
const fakeNonce = "contract-check-raw-nonce";

function preparePath(contract: FrontendContract, user: UserActor): string {
  return contract.path.replace("username=taken", `username=${encodeURIComponent(user.username)}`);
}

function prepareBody(contract: FrontendContract, user: UserActor, password: string): unknown {
  if (contract.path.endsWith("/auth/login")) return { identifier: user.email, password };
  if (contract.path.endsWith("/auth/google")) return { idToken: fakeProviderToken, nonce: fakeNonce };
  if (contract.path.endsWith("/auth/apple")) return { identityToken: fakeProviderToken, nonce: fakeNonce };
  if (contract.body && typeof contract.body === "object" && "previewUri" in contract.body) {
    const { previewUri: _ignored, ...rest } = contract.body as Record<string, unknown>;
    return rest;
  }
  return contract.body;
}

async function runAppContracts(app: string, contracts: readonly FrontendContract[], validate: Validator, user: UserActor): Promise<ContractOutcome[]> {
  const outcomes: ContractOutcome[] = [];
  for (const contract of contracts) {
    if (mockOnlyIds.test(contract.path)) {
      outcomes.push({ app, method: contract.method, path: contract.path, status: "skipped", problems: ["path uses a mock fixture id"] });
      continue;
    }
    const response = await callApi(contract.method, preparePath(contract, user), { token: user.accessToken, body: prepareBody(contract, user, "Sm0ke-Test-Pass!2026") });
    if (socialSignIn.test(contract.path) && response.status === 503) {
      outcomes.push({ app, method: contract.method, path: contract.path, status: response.status, problems: response.body?.code === "SOCIAL_SIGN_IN_NOT_CONFIGURED" ? [] : [`expected SOCIAL_SIGN_IN_NOT_CONFIGURED, got ${JSON.stringify(response.body)}`] });
      continue;
    }
    const problems = response.status >= 400 ? [`HTTP ${response.status}: ${JSON.stringify(response.body).slice(0, 200)}`] : validate(contract.schema, response.body);
    outcomes.push({ app, method: contract.method, path: contract.path, status: response.status, problems });
  }
  return outcomes;
}

describe("frontend contracts against the real gateway", () => {
  let user: UserActor;
  let staff: StaffActor;
  const outcomes: ContractOutcome[] = [];

  beforeAll(async () => {
    user = await registerUser("contract");
    staff = await createSuperadmin();
  });

  it("mobile, webapp and studio contract lists match the live responses", async () => {
    const lists = [
      ["mobile", "identity.contract.ts", "identityContracts"],
      ["webapp", "webapp.contract.ts", "webappContracts"],
      ["studio", "studio.contract.ts", "studioContracts"],
    ] as const;
    for (const [app, file, exportName] of lists) {
      const { contracts, validate } = await loadAppContracts(app, file, exportName);
      outcomes.push(...(await runAppContracts(app, contracts, validate, user)));
    }
  });

  it("seller, ads and admin BFF contracts match the live responses", async () => {
    const { validate, c } = await loadAppContracts("webapp", "webapp.contract.ts", "webappContracts");
    const schema = c as unknown as { object: (fields: Record<string, unknown>, optional?: string[]) => unknown; string: () => unknown; any: () => unknown; array: (item: unknown) => unknown; nullable: (inner: unknown) => unknown; number: () => unknown };
    const login = await logInUser(user.email);
    const sessionSchema = schema.object({ accessToken: schema.string(), refreshToken: schema.string(), user: schema.object({ id: schema.string() }, []) });
    const loginResponse = await callApi("POST", "/api/v1/auth/login", { body: { identifier: user.email, password: "Sm0ke-Test-Pass!2026" } });
    outcomes.push({ app: "seller", method: "POST", path: "/api/v1/auth/login", status: loginResponse.status, problems: validate(sessionSchema, loginResponse.body) });
    const failure = await callApi("POST", "/api/v1/auth/login", { body: { identifier: user.email, password: "wrong-password-1" } });
    outcomes.push({ app: "seller", method: "POST", path: "/api/v1/auth/login (bad password)", status: failure.status, problems: [...(failure.status === 401 ? [] : [`expected 401, got ${failure.status}`]), ...validate(schema.object({ message: schema.string(), code: schema.string() }), failure.body)] });
    const access = await callApi("GET", "/api/v1/seller/access", { token: login.accessToken });
    outcomes.push({ app: "seller", method: "GET", path: "/api/v1/seller/access", status: access.status, problems: access.status === 200 ? validate(schema.object({ storeId: schema.nullable(schema.string()), role: schema.nullable(schema.string()) }, []), access.body) : [`HTTP ${access.status}`] });
    const memberships = await callApi("GET", "/api/v1/ads/memberships", { token: login.accessToken });
    outcomes.push({ app: "ads", method: "GET", path: "/api/v1/ads/memberships", status: memberships.status, problems: memberships.status === 200 ? validate(schema.object({ data: schema.array(schema.any()), nextCursor: schema.nullable(schema.string()) }), memberships.body) : [`HTTP ${memberships.status}`] });
    const admins = await callApi("GET", "/api/v1/admin/admins", { token: staff.accessToken });
    outcomes.push({ app: "admin", method: "GET", path: "/api/v1/admin/admins", status: admins.status, problems: admins.status === 200 ? validate(schema.object({ data: schema.array(schema.any()) }, []), admins.body) : [`HTTP ${admins.status}`] });
    const me = await callApi("GET", "/api/v1/admin/auth/me", { token: staff.accessToken });
    outcomes.push({ app: "admin", method: "GET", path: "/api/v1/admin/auth/me", status: me.status, problems: me.status === 200 ? validate(schema.object({ id: schema.string(), email: schema.string(), name: schema.string(), role: schema.string(), permissions: schema.array(schema.string()) }, []), me.body) : [`HTTP ${me.status}`] });
  });

  it("reports every failing contract", () => {
    writeSmokeReport("frontendContracts", outcomes);
    const failing = outcomes.filter((outcome) => outcome.status !== "skipped" && outcome.problems.length > 0);
    expect(failing, JSON.stringify(failing, null, 2)).toEqual([]);
  });
});
