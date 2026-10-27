import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { repositoryRoot } from "../environment.js";
import { callApi, describeResponse, generateTimeBasedCode, stepUpStaff, uniqueSuffix, type StaffActor } from "../smokeBridge.js";

export interface PendingStaff {
  readonly email: string;
  readonly password: string;
}

export function bootstrapUnenrolledSuperadmin(): PendingStaff {
  const email = `e2e.staff.${uniqueSuffix()}@nantty.com`;
  const password = "Copper-Harbor-Signal-2026!";
  const env = { ...process.env, ADMIN_DATABASE_URL: process.env["SMOKE_ADMIN_DATABASE_URL"] ?? "postgres://svc_admin:svc_admin_local_only@localhost:15432/nantty?sslmode=disable", ADMIN_BOOTSTRAP_PASSWORD: password };
  const binary = process.env["SMOKE_BOOTSTRAP_SUPERADMIN_BINARY"];
  if (binary !== undefined && binary !== "") execFileSync(binary, ["-email", email, "-name", "E2E Staff"], { env, stdio: "pipe" });
  else execFileSync("go", ["run", "./cmd/bootstrapSuperadmin", "-email", email, "-name", "E2E Staff"], { cwd: resolve(repositoryRoot, "services/go/modules/admin"), env, stdio: "pipe" });
  return { email, password };
}

const lastWindowBySecret = new Map<string, number>();

export async function freshTotp(secret: string): Promise<string> {
  const window = () => Math.floor(Date.now() / 30_000);
  const last = lastWindowBySecret.get(secret);
  if (last !== undefined && last >= window()) await new Promise((done) => setTimeout(done, (last + 1) * 30_000 - Date.now() + 300));
  lastWindowBySecret.set(secret, window());
  return generateTimeBasedCode(secret);
}

export async function seedReservedUsernames(staff: StaffActor, count: number, prefix: string): Promise<string[]> {
  const terms: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const term = `${prefix}${index.toString().padStart(3, "0")}`;
    const created = await callApi("POST", "/api/v1/admin/usernames/reserved", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { term, matchKind: "exact" } });
    if (created.status !== 201 && created.status !== 200) throw new Error(`reserve ${term}: ${describeResponse(created)}`);
    terms.push(term);
  }
  return terms;
}
