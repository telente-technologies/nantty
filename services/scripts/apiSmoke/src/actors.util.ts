import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { callApi, describeResponse, uniqueSuffix, waitFor } from "./apiClient.util.js";
import { generateTimeBasedCode } from "./oneTimePassword.util.js";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const identityLogPath = process.env["SMOKE_IDENTITY_LOG"] ?? "";
export const smokePassword = "Sm0ke-Test-Pass!2026";

export interface UserActor {
  readonly accountId: string;
  readonly username: string;
  readonly email: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface StaffActor {
  readonly staffId: string;
  readonly email: string;
  readonly accessToken: string;
  readonly totpSecret: string;
  readonly password: string;
}

function decodeTokenSubject(accessToken: string): string {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { sub: string };
  return payload.sub;
}

export async function readOneTimeCodeFromIdentityLog(email: string, purpose: string): Promise<string> {
  if (identityLogPath === "") throw new Error("SMOKE_IDENTITY_LOG must point at the go-identity log (AUTH_OTP_DELIVERY=log)");
  const pattern = new RegExp(`one-time ${purpose} passcode for ${email.replace(/[.+]/g, "\\$&")} is (\\d{6})`, "g");
  const code = await waitFor(async () => {
    const matches = [...readFileSync(identityLogPath, "utf8").matchAll(pattern)];
    return matches.at(-1)?.[1];
  }, 10_000, 200);
  if (code === undefined) throw new Error(`no ${purpose} code for ${email} in ${identityLogPath}`);
  return code;
}

export async function registerUser(prefix: string): Promise<UserActor> {
  const suffix = uniqueSuffix();
  const username = `${prefix}${suffix}`.toLowerCase().slice(0, 28);
  const email = `${username}@smoke.zudomart.test`;
  const sent = await callApi("POST", "/api/v1/auth/otp/send", { body: { destination: email, purpose: "signup" } });
  if (sent.status !== 200) throw new Error(`otp send: ${describeResponse(sent)}`);
  const code = await readOneTimeCodeFromIdentityLog(email, "signup");
  const verified = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: email, code, purpose: "signup" } });
  if (verified.status !== 200) throw new Error(`otp verify: ${describeResponse(verified)}`);
  const registered = await callApi("POST", "/api/v1/auth/register", { body: { email, birthday: "1994-05-17", password: smokePassword, username, name: `Smoke ${prefix}`, otpToken: verified.body.otpToken } });
  if (registered.status !== 201 && registered.status !== 200) throw new Error(`register: ${describeResponse(registered)}`);
  const profile = await callApi("GET", "/api/v1/users/me", { token: registered.body.accessToken });
  if (profile.status !== 200) throw new Error(`profile after signup: ${describeResponse(profile)}`);
  return { accountId: decodeTokenSubject(registered.body.accessToken), username, email, accessToken: registered.body.accessToken, refreshToken: registered.body.refreshToken };
}

export async function logInUser(email: string): Promise<{ readonly accessToken: string; readonly refreshToken: string; readonly status: number }> {
  const response = await callApi("POST", "/api/v1/auth/login", { body: { identifier: email, password: smokePassword } });
  return { accessToken: response.body?.accessToken, refreshToken: response.body?.refreshToken, status: response.status };
}

function bootstrapSuperadmin(email: string, password: string): void {
  const environment = { ...process.env, ADMIN_DATABASE_URL: process.env["SMOKE_ADMIN_DATABASE_URL"] ?? "postgres://svc_admin:svc_admin_local_only@localhost:15432/zudomart?sslmode=disable", ADMIN_BOOTSTRAP_PASSWORD: password };
  const binary = process.env["SMOKE_BOOTSTRAP_SUPERADMIN_BINARY"];
  if (binary !== undefined && binary !== "") execFileSync(binary, ["-email", email, "-name", "Smoke Staff"], { env: environment, stdio: "pipe" });
  else execFileSync("go", ["run", "./cmd/bootstrapSuperadmin", "-email", email, "-name", "Smoke Staff"], { cwd: resolve(repositoryRoot, "services/go/modules/admin"), env: environment, stdio: "pipe" });
}

export async function createSuperadmin(): Promise<StaffActor> {
  const email = `smoke.staff.${uniqueSuffix()}@zudomart.com`;
  const password = "Smoke-Staff-Pass-2026!";
  bootstrapSuperadmin(email, password);
  const login = await callApi("POST", "/api/v1/admin/auth/login", { body: { email, password } });
  if (login.body?.status !== "mfa_enrollment_required") throw new Error(`staff login: ${describeResponse(login)}`);
  const enrollment = await callApi("POST", "/api/v1/admin/auth/mfa/enroll/start", { body: { challengeToken: login.body.challengeToken } });
  const totpSecret: string = enrollment.body.secret;
  const confirmed = await callApi("POST", "/api/v1/admin/auth/mfa/enroll/confirm", { body: { challengeToken: login.body.challengeToken, code: await generateUnusedTimeBasedCode(totpSecret) } });
  if (confirmed.status !== 200 || typeof confirmed.body?.accessToken !== "string") throw new Error(`staff mfa confirm: ${describeResponse(confirmed)}`);
  const me = await callApi("GET", "/api/v1/admin/auth/me", { token: confirmed.body.accessToken });
  return { staffId: me.body?.id ?? me.body?.staff?.id ?? "", email, accessToken: confirmed.body.accessToken, totpSecret, password };
}

const lastUsedTotpWindowBySecret = new Map<string, number>();

async function generateUnusedTimeBasedCode(secret: string): Promise<string> {
  const currentWindow = () => Math.floor(Date.now() / 30_000);
  const lastUsed = lastUsedTotpWindowBySecret.get(secret);
  if (lastUsed !== undefined && lastUsed >= currentWindow()) await new Promise((resolve) => setTimeout(resolve, (lastUsed + 1) * 30_000 - Date.now() + 250));
  lastUsedTotpWindowBySecret.set(secret, currentWindow());
  return generateTimeBasedCode(secret);
}

const stepUpTokenCache = new Map<string, { readonly token: string; readonly expiresAt: number }>();

export async function stepUpStaff(staff: StaffActor): Promise<string> {
  const cached = stepUpTokenCache.get(staff.accessToken);
  if (cached !== undefined && cached.expiresAt > Date.now()) return cached.token;
  const response = await callApi("POST", "/api/v1/admin/auth/step-up", { token: staff.accessToken, body: { code: await generateUnusedTimeBasedCode(staff.totpSecret) } });
  if (response.status !== 200) throw new Error(`step-up: ${describeResponse(response)}`);
  const token: string = response.body.stepUpToken ?? response.body.token;
  stepUpTokenCache.set(staff.accessToken, { token, expiresAt: Date.now() + 4 * 60_000 });
  return token;
}
