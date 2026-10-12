import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, logInUser, registerUser, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi } from "../src/apiClient.util.js";
import { createStoreWithProduct } from "../src/commerceFixtures.util.js";
import { approveExistingUserAsCreator, withRelaxedCreatorThresholds } from "../src/liveFixtures.util.js";
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
const mockOnlyIds = /\/(live_\w+|post_\w+|user_\w+|scene_\w+)(\/|$)/;
const persistedFixtureIds = ["post_2", "cm_1", "cm_4"];
const socialSignIn = /\/auth\/(google|apple)$/;

async function loadAppContracts(app: string, file: string, exportName: string): Promise<{ contracts: readonly FrontendContract[]; validate: Validator; c: Record<string, (...args: never[]) => unknown> }> {
  const contractModule = (await import(pathToFileURL(resolve(appsRoot, app, "src/contracts", file)).href)) as Record<string, unknown>;
  const schemaModule = (await import(pathToFileURL(resolve(appsRoot, app, "src/contracts/contractSchema.util.ts")).href)) as { validateAgainstContract: Validator; c: Record<string, (...args: never[]) => unknown> };
  return { contracts: contractModule[exportName] as readonly FrontendContract[], validate: schemaModule.validateAgainstContract, c: schemaModule.c };
}

const fakeProviderToken = "header.payload.signature-for-contract-check";
const fakeNonce = "contract-check-raw-nonce";

interface ContractFixtures {
  readonly ids: Readonly<Record<string, string>>;
  readonly storeId: string;
}

let fixtures: ContractFixtures = { ids: {}, storeId: "" };

function substituteFixtureIds(text: string): string {
  return Object.entries(fixtures.ids).reduce((current, [mockId, realId]) => current.replace(new RegExp(`\\b${mockId}\\b`, "g"), realId), text);
}

function preparePath(contract: FrontendContract, user: UserActor): string {
  return substituteFixtureIds(contract.path.replace("username=taken", `username=${encodeURIComponent(user.username)}`));
}

function prepareBody(contract: FrontendContract, user: UserActor, password: string): unknown {
  if (contract.path.endsWith("/auth/login")) return { identifier: user.email, password };
  if (contract.path.endsWith("/auth/google")) return { idToken: fakeProviderToken, nonce: fakeNonce };
  if (contract.path.endsWith("/auth/apple")) return { identityToken: fakeProviderToken, nonce: fakeNonce };
  if (contract.body && typeof contract.body === "object" && "previewUri" in contract.body) {
    const { previewUri: _ignored, ...rest } = contract.body as Record<string, unknown>;
    return rest;
  }
  return contract.body === undefined ? undefined : JSON.parse(substituteFixtureIds(JSON.stringify(contract.body)));
}

async function runAppContracts(app: string, contracts: readonly FrontendContract[], validate: Validator, user: UserActor): Promise<ContractOutcome[]> {
  const outcomes: ContractOutcome[] = [];
  for (const contract of contracts) {
    if (mockOnlyIds.test(contract.path.replace(new RegExp(`\\b(${persistedFixtureIds.join("|")})\\b`, "g"), "real"))) {
      outcomes.push({ app, method: contract.method, path: contract.path, status: "skipped", problems: ["path uses a mock fixture id"] });
      continue;
    }
    const response = await callApi(contract.method, preparePath(contract, user), { token: user.accessToken, headers: fixtures.storeId === "" ? {} : { "x-store-id": fixtures.storeId, "x-seller-store": fixtures.storeId }, body: prepareBody(contract, user, "Sm0ke-Test-Pass!2026") });
    if (socialSignIn.test(contract.path) && response.status === 503) {
      outcomes.push({ app, method: contract.method, path: contract.path, status: response.status, problems: response.body?.code === "SOCIAL_SIGN_IN_NOT_CONFIGURED" ? [] : [`expected SOCIAL_SIGN_IN_NOT_CONFIGURED, got ${JSON.stringify(response.body)}`] });
      continue;
    }
    const problems = response.status >= 400 ? [`HTTP ${response.status}: ${JSON.stringify(response.body).slice(0, 200)}`] : validate(contract.schema, response.body);
    outcomes.push({ app, method: contract.method, path: contract.path, status: response.status, problems });
  }
  return outcomes;
}

async function postWithComments(author: UserActor, commenter: UserActor): Promise<{ postId: string; commentIds: string[] }> {
  const post = await callApi("POST", "/api/v1/posts", { token: author.accessToken, body: { text: "Contract check post", audience: "everyone" } });
  expect(post.status, JSON.stringify(post.body)).toBe(201);
  const postId = String(post.body.id);
  const commentIds: string[] = [];
  for (const text of ["Do you ship to Abuja?", "Lovely colours"]) {
    const comment = await callApi("POST", `/api/v1/posts/${postId}/comments`, { token: commenter.accessToken, body: { text } });
    expect(comment.status, JSON.stringify(comment.body)).toBe(201);
    commentIds.push(String(comment.body.id));
  }
  return { postId, commentIds };
}

describe("frontend contracts against the real gateway", () => {
  let user: UserActor;
  let staff: StaffActor;
  const outcomes: ContractOutcome[] = [];

  beforeAll(async () => {
    staff = await createSuperadmin();
    const store = await createStoreWithProduct("contract", 250_000);
    user = await withRelaxedCreatorThresholds(staff, () => approveExistingUserAsCreator(staff, store.seller));
    const other = await registerUser("contractpeer");
    const commented = await postWithComments(user, other);
    fixtures = {
      storeId: store.storeId,
      ids: { u_me: user.accountId, u_21: other.accountId, f_1: other.accountId, post_1: randomUUID(), post_missing: randomUUID(), store_1: store.storeId, prod_1: store.productId, post_2: commented.postId, cm_4: commented.commentIds[0]!, cm_1: commented.commentIds[1]! },
    };
  }, 300_000);

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
