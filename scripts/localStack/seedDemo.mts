// Idempotent demo data for the local stack: a buyer, a seller with a store and products, a creator with posts, clips
// and a live, and a staff admin. Every step checks what already exists first, so reruns only fill gaps.
// Run through `pnpm backend:up` (or: services/scripts/apiSmoke/node_modules/.bin/tsx scripts/localStack/seedDemo.mts).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createSuperadmin, readOneTimeCodeFromIdentityLog, stepUpStaff, type StaffActor } from "../../services/scripts/apiSmoke/src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../../services/scripts/apiSmoke/src/apiClient.util.js";
import { uploadSampleImage } from "../../services/scripts/apiSmoke/src/mediaUpload.util.js";
import { demoAccounts, demoAdmin, demoPassword, demoProducts, type DemoAccount } from "./demoAccounts.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const statePath = resolve(repositoryRoot, ".data/localStack/demoSeed.json");
const state: Record<string, string> = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const saveState = () => { mkdirSync(dirname(statePath), { recursive: true }); writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`); };
const okStatus = (status: number) => status >= 200 && status < 300;

interface Session { readonly account: DemoAccount; readonly accountId: string; accessToken: string; readonly refreshToken: string }

function must(condition: boolean, what: string, response: Parameters<typeof describeResponse>[0]): void {
  if (!condition) throw new Error(`${what}: ${describeResponse(response)}`);
}

function subjectOf(accessToken: string): string {
  return (JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { sub: string }).sub;
}

function psql(statement: string): string {
  return execFileSync("docker", ["exec", "nantty-backend-postgres-1", "psql", "-U", "nantty", "-d", "nantty", "-At", "-c", statement], { encoding: "utf8" }).trim();
}

async function signIn(account: DemoAccount): Promise<Session> {
  const login = await callApi("POST", "/api/v1/auth/login", { body: { identifier: account.email, password: demoPassword } });
  if (login.status === 200 && typeof login.body?.accessToken === "string") {
    console.log(`  ${account.role}: ${account.email} exists`);
    return { account, accountId: subjectOf(login.body.accessToken), accessToken: login.body.accessToken, refreshToken: login.body.refreshToken };
  }
  const sent = await callApi("POST", "/api/v1/auth/otp/send", { body: { destination: account.email, purpose: "signup" } });
  must(sent.status === 200, `otp send for ${account.email} (login said ${login.status})`, sent);
  const code = await readOneTimeCodeFromIdentityLog(account.email, "signup");
  const verified = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: account.email, code, purpose: "signup" } });
  must(verified.status === 200, "otp verify", verified);
  const registered = await callApi("POST", "/api/v1/auth/register", { body: { email: account.email, birthday: "1994-05-17", password: demoPassword, username: account.username, name: account.name, otpToken: verified.body.otpToken } });
  must(okStatus(registered.status), `register ${account.email}`, registered);
  await callApi("PATCH", "/api/v1/users/me/preferences", { token: registered.body.accessToken, body: { countryCode: "NG" } });
  await callApi("PATCH", "/api/v1/users/me", { token: registered.body.accessToken, body: { bio: account.bio } });
  console.log(`  ${account.role}: ${account.email} created`);
  return { account, accountId: subjectOf(registered.body.accessToken), accessToken: registered.body.accessToken, refreshToken: registered.body.refreshToken };
}

async function refresh(session: Session): Promise<void> {
  const refreshed = await callApi("POST", "/api/v1/auth/refresh", { body: { refreshToken: session.refreshToken } });
  if (refreshed.status === 200) Object.assign(session, { accessToken: refreshed.body.accessToken, refreshToken: refreshed.body.refreshToken });
}

async function stillExists(key: string, path: (id: string) => string, token?: string): Promise<boolean> {
  const id = state[key];
  if (id === undefined) return false;
  return (await callApi("GET", path(id), token === undefined ? {} : { token })).status === 200;
}

async function ensureStore(seller: Session): Promise<string> {
  if (await stillExists("storeId", (id) => `/api/v1/stores/${id}`)) return state["storeId"] as string;
  const approved = psql(`select count(*) from catalog.seller_applications where account_id = '${seller.accountId}' and status = 'approved'`);
  if (approved === "0") {
    psql(`insert into catalog.seller_applications (id, created_at, updated_at, account_id, status, store_name, category_id, phone_sealed, address_line, city, state, identity_document_type, identity_document_number_sealed, identity_document_last4, identity_document_photo_url, payout_bank_code, payout_account_number_sealed, payout_account_last4)
      values (gen_random_uuid(), now(), now(), '${seller.accountId}', 'approved', 'Ife Lifestyle Demo', gen_random_uuid(), '\\x00', '4 Allen Avenue', 'Ikeja', 'Lagos', 'nin', '\\x00', '0000', 'https://cdn.test/id.jpg', '058', '\\x00', '0000')`);
  }
  const handle = "ifelifestyledemo";
  let profile = await callApi("POST", "/api/v1/users/me/business-profiles", { token: seller.accessToken, body: { displayName: "Ife Lifestyle (demo)", handle, description: "Demo store seeded for local development", businessType: "business", purpose: "store", categories: [{ customName: "Fashion" }] } });
  let businessProfileId: string | undefined = profile.body?.id ?? profile.body?.profile?.id;
  if (!okStatus(profile.status)) {
    profile = await callApi("GET", "/api/v1/users/me/business-profiles", { token: seller.accessToken });
    businessProfileId = (profile.body?.data ?? profile.body ?? []).find?.((candidate: { handle?: string }) => candidate.handle === handle)?.id;
  }
  if (businessProfileId === undefined) throw new Error(`business profile: ${describeResponse(profile)}`);
  const store = await callApi("POST", "/api/v1/stores", { token: seller.accessToken, body: { businessProfileId, name: "Ife Lifestyle (demo)", description: "Demo store seeded for local development", countryCode: "NG" } });
  must(store.status === 201, "store", store);
  state["storeId"] = store.body.id ?? store.body.store?.id;
  saveState();
  await callApi("POST", "/api/v1/seller/shipping/rules", { token: seller.accessToken, headers: { "X-Seller-Store": state["storeId"] as string }, body: { zoneName: "Nationwide", destinations: [{ level: "country", countryCode: "NG" }], type: "flat_fee", feeMinor: 150000, active: true } });
  console.log(`  store ${state["storeId"]} created`);
  return state["storeId"] as string;
}

async function ensureProducts(seller: Session, storeId: string): Promise<void> {
  const headers = { "X-Seller-Store": storeId };
  const locations = await callApi("GET", "/api/v1/seller/locations", { token: seller.accessToken, headers });
  const locationId: string | undefined = locations.body?.data?.[0]?.id;
  for (const [index, product] of demoProducts.entries()) {
    const key = `product${index}`;
    if (await stillExists(key, (id) => `/api/v1/products/${id}`)) continue;
    const image = await uploadSampleImage(seller.accessToken, "product");
    const created = await callApi("POST", "/api/v1/seller/products", { token: seller.accessToken, headers, body: { name: product.name, description: product.description, status: "active", taxable: false, trackInventory: true, publishedOnline: true, tags: ["demo"], options: [], imageMediaIds: [image.mediaId], variants: [{ optionValues: {}, sku: product.sku, priceMinor: product.priceMinor, lowStockThreshold: 2, openingStock: locationId === undefined ? [] : [{ locationId, quantity: 40 }] }] } });
    must(created.status === 201, `product ${product.name}`, created);
    state[key] = created.body.id ?? created.body.product?.id;
    saveState();
    await waitFor(async () => ((await callApi("GET", `/api/v1/products/${state[key]}`)).status === 200 ? true : undefined), 15_000, 500);
    console.log(`  product "${product.name}" created`);
  }
}

async function relaxCreatorThresholds(staff: StaffActor): Promise<() => Promise<void>> {
  const current = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
  must(current.status === 200, "creator thresholds", current);
  const original = current.body.value;
  const value = { ...original, autoApprove: { ...original.autoApprove, minimumAccountAgeDays: 0, minimumRealFollowers: 0, minimumOriginalPostsInLast60Days: 0 }, manualReview: { ...original.manualReview, minimumRealFollowers: 0 } };
  const relaxed = await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value, expectedVersion: current.body.version, reason: "Local demo seed needs an instant creator" } });
  must(relaxed.status === 200, "relax creator thresholds", relaxed);
  return async () => {
    const latest = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
    await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: original, expectedVersion: latest.body.version, reason: "Restore after local demo seed" } });
  };
}

async function ensureCreatorApproved(creator: Session): Promise<void> {
  const statusOf = async () => (await callApi("GET", "/api/v1/creators/applications/me", { token: creator.accessToken })).body ?? {};
  if ((await statusOf()).status === "approved") return;
  psql(`delete from users.creator_applications where account_id = '${creator.accountId}' and status = 'rejected'`);
  const staff = await createSuperadmin();
  const restore = await relaxCreatorThresholds(staff);
  try {
    await callApi("POST", "/api/v1/users/me/creator-application", { token: creator.accessToken, body: {} });
    const mine = await statusOf();
    if (mine.status === "pending") {
      const approved = await callApi("POST", `/api/v1/admin/applications/creators/${mine.id ?? mine.application?.id}/approve`, { token: staff.accessToken, body: { reason: "Local demo seed" } });
      must([200, 204].includes(approved.status), "creator approval", approved);
    }
  } finally {
    await restore();
  }
  const final = await statusOf();
  if (final.status !== "approved") throw new Error(`creator application is ${final.status}: ${JSON.stringify(final).slice(0, 300)}`);
  await refresh(creator);
  console.log("  creator approved");
}

const clipFixturePath = resolve(repositoryRoot, "scripts/localStack/fixtures/demoClip.mp4");

async function uploadClipVideo(accessToken: string): Promise<string> {
  const bytes = readFileSync(clipFixturePath);
  const plan = await callApi("POST", "/api/v1/media/uploads", { token: accessToken, body: { fileName: "demoClip.mp4", mimeType: "video/mp4", sizeBytes: bytes.length, purpose: "clip", sha256: createHash("sha256").update(bytes).digest("hex") } });
  must(plan.status === 201, "video upload plan", plan);
  const put = await fetch(plan.body.url, { method: "PUT", body: new Uint8Array(bytes), headers: { ...(plan.body.headers ?? {}), "content-type": "video/mp4" } });
  if (put.status !== 200) throw new Error(`video PUT ${put.status}`);
  const completed = await callApi("POST", `/api/v1/media/uploads/${plan.body.uploadId}/complete`, { token: accessToken, body: {} });
  must(completed.status === 200, "video upload complete", completed);
  const status = await waitFor(async () => {
    const media = await callApi("GET", `/api/v1/media/${plan.body.mediaId}`, { token: accessToken });
    return media.body?.status === "ready" || media.body?.status === "failed" ? media.body.status : undefined;
  }, 180_000, 1000);
  if (status !== "ready") throw new Error(`clip video ${plan.body.mediaId} is ${status ?? "still processing"} (media needs ffmpeg; backend:up provides a Docker one)`);
  return plan.body.mediaId;
}

async function ensurePosts(creator: Session): Promise<void> {
  const posts = [
    { key: "post0", text: "Fresh ankara drop this weekend. Which colour should I style next? #fashion" },
    { key: "post1", text: "Behind the scenes at the Lekki shoot" },
  ];
  for (const post of posts) {
    if (await stillExists(post.key, (id) => `/api/v1/posts/${id}`)) continue;
    const image = await uploadSampleImage(creator.accessToken);
    const created = await callApi("POST", "/api/v1/posts", { token: creator.accessToken, body: { text: post.text, audience: "everyone", mediaIds: [image.mediaId] } });
    must(okStatus(created.status), post.key, created);
    state[post.key] = created.body.id ?? created.body.post?.id;
    saveState();
    console.log(`  ${post.key} created`);
  }
  const clips = ["Lagos street style in four seconds #fashion", "Three ways to tie a gele", "Market run: what NGN 20,000 gets you"];
  for (const [index, text] of clips.entries()) {
    const key = `clip${index}`;
    if (await stillExists(key, (id) => `/api/v1/posts/${id}`)) continue;
    const mediaId = await uploadClipVideo(creator.accessToken);
    const created = await callApi("POST", "/api/v1/posts", { token: creator.accessToken, body: { kind: "clip", text, audience: "everyone", mediaIds: [mediaId] } });
    must(okStatus(created.status), key, created);
    state[key] = created.body.id ?? created.body.post?.id;
    saveState();
    console.log(`  ${key} created`);
  }
}

async function verificationLevel(session: Session): Promise<number> {
  const level = await callApi("GET", "/api/v1/payments/verification/me", { token: session.accessToken });
  return typeof level.body?.level === "number" ? level.body.level : 0;
}

// Level 1 (payout verified) through the real payout-onboarding API against the fake Flutterwave.
async function ensurePayoutVerified(session: Session): Promise<void> {
  if ((await verificationLevel(session)) >= 1) return;
  const accountNumber = `20${session.accountId.replace(/[^0-9]/g, "").padEnd(8, "7").slice(0, 8)}`;
  const resolved = await callApi("POST", "/api/v1/payments/payout-onboarding/me/resolve", { token: session.accessToken, body: { bankCode: "058", accountNumber } });
  must(resolved.status === 200, "resolve payout account", resolved);
  const legalName: string = resolved.body.accountName ?? session.account.name;
  const identity = await callApi("PUT", "/api/v1/payments/payout-onboarding/me/identity", { token: session.accessToken, body: { legalName, dateOfBirth: "1994-05-17", addressLine1: "4 Allen Avenue", city: "Ikeja", state: "Lagos", idType: "bvn", idNumber: "22212345678", registeredBusiness: false } });
  must(okStatus(identity.status), "payout identity", identity);
  const stepUp = await callApi("POST", "/api/v1/auth/step-up", { token: session.accessToken, body: { password: demoPassword } });
  must(stepUp.status === 200, "step-up", stepUp);
  const bank = await callApi("PUT", "/api/v1/payments/payout-onboarding/me/bank", { token: session.accessToken, headers: { "x-step-up-token": stepUp.body.stepUpToken }, body: { bankCode: "058", bankName: "Guaranty Trust Bank", accountNumber, resolvedAccountName: legalName } });
  must(okStatus(bank.status), "payout bank", bank);
  const consent = await callApi("POST", "/api/v1/payments/payout-onboarding/me/bank-validation", { token: session.accessToken });
  must(okStatus(consent.status), "BVN consent", consent);
  const consented = await waitFor(async () => ((await callApi("GET", "/api/v1/payments/payout-onboarding/me/bank-validation", { token: session.accessToken })).body?.status === "verified" ? true : undefined), 30_000, 1000);
  if (consented === undefined) throw new Error(`BVN consent for ${session.account.email} never verified`);
  const verified = await waitFor(async () => ((await verificationLevel(session)) >= 1 ? true : undefined), 90_000, 2000);
  if (verified === undefined) throw new Error(`${session.account.email} did not reach verification level 1 after payout onboarding`);
  const wallet = await callApi("POST", "/api/v1/payments/wallet/me/activate", { token: session.accessToken });
  must(okStatus(wallet.status), "wallet activation", wallet);
  console.log(`  ${session.account.role} payout-verified (level 1) with a wallet`);
}

async function ensureLive(creator: Session): Promise<void> {
  if (state["liveId"] !== undefined) {
    const live = await callApi("GET", `/api/v1/lives/${state["liveId"]}`, { token: creator.accessToken });
    if (live.status === 200 && /"(live|scheduled|active)"/.test(JSON.stringify(live.body))) return;
  }
  const created = await callApi("POST", "/api/v1/lives", { token: creator.accessToken, body: { title: "Demo live: Saturday styling session", category: "justChatting", visibility: "public", startNow: true } });
  if (!okStatus(created.status)) {
    console.warn(`  live not created (optional): ${describeResponse(created)}`);
    return;
  }
  state["liveId"] = created.body.id ?? created.body.live?.id;
  saveState();
  console.log(`  live ${state["liveId"]} started`);
}

async function ensureBuyer(buyer: Session, creator: Session, seller: Session): Promise<void> {
  for (const target of [creator, seller]) await callApi("POST", `/api/v1/users/${target.accountId}/follow`, { token: buyer.accessToken, body: {} });
  const addresses = await callApi("GET", "/api/v1/users/me/addresses", { token: buyer.accessToken });
  if ((addresses.body?.data ?? addresses.body ?? []).length > 0) return;
  const countries = await callApi("GET", "/api/v1/geo/countries");
  const nigeria = countries.body.data.find((country: { code: string }) => country.code === "NG");
  const regions = await callApi("GET", `/api/v1/geo/countries/${nigeria.id}/regions`);
  const lagos = regions.body.data.find((region: { name: string }) => /lagos/i.test(region.name)) ?? regions.body.data[0];
  const areas = await callApi("GET", `/api/v1/geo/regions/${lagos.id}/admin-areas`);
  const lga = areas.body.data.find((area: { name: string }) => /ikeja/i.test(area.name)) ?? areas.body.data[0];
  const address = await callApi("POST", "/api/v1/users/me/addresses", { token: buyer.accessToken, body: { label: "Home", fullName: buyer.account.name, phone: "+2348012345678", line1: "4 Allen Avenue", countryId: nigeria.id, stateId: lagos.id, lgaId: lga.id, city: "Ikeja", isDefault: true } });
  must(address.status === 201, "buyer address", address);
  console.log("  buyer address added, following creator and seller");
}

function ensureStaffAdmin(): void {
  const exists = psql(`select count(*) from admin.staff_accounts where email = '${demoAdmin.email}'`);
  if (exists !== "0") return;
  const environment = { ...process.env, ADMIN_DATABASE_URL: process.env["SMOKE_ADMIN_DATABASE_URL"] ?? "postgres://svc_admin:svc_admin_local_only@localhost:15432/nantty?sslmode=disable", ADMIN_BOOTSTRAP_PASSWORD: demoAdmin.password };
  const binary = process.env["SMOKE_BOOTSTRAP_SUPERADMIN_BINARY"];
  try {
    if (binary) execFileSync(binary, ["-email", demoAdmin.email, "-name", demoAdmin.name], { env: environment, stdio: "pipe" });
    else execFileSync("go", ["run", "./cmd/bootstrapSuperadmin", "-email", demoAdmin.email, "-name", demoAdmin.name], { cwd: resolve(repositoryRoot, "services/go/modules/admin"), env: environment, stdio: "pipe" });
  } catch (error) {
    throw new Error(`staff admin bootstrap failed: ${String((error as { stderr?: Buffer }).stderr ?? error).trim()}`);
  }
  console.log(`  staff admin ${demoAdmin.email} created (enrol MFA at first sign-in)`);
}

const health = await waitFor(async () => ((await callApi("GET", "/healthz").catch(() => ({ status: 0 }))).status === 200 ? true : undefined), 30_000, 1000);
if (health === undefined) throw new Error("gateway is not healthy; run pnpm backend:up first");
console.log("[seed] accounts");
const sessions = Object.fromEntries(await Promise.all(demoAccounts.map(async (account) => [account.role, await signIn(account)] as const))) as Record<DemoAccount["role"], Session>;
console.log("[seed] seller store and products");
await ensureProducts(sessions.seller, await ensureStore(sessions.seller));
console.log("[seed] creator posts, clips and live");
await ensureCreatorApproved(sessions.creator);
await ensurePayoutVerified(sessions.creator);
await ensurePosts(sessions.creator);
await ensureLive(sessions.creator);
console.log("[seed] buyer");
await ensureBuyer(sessions.buyer, sessions.creator, sessions.seller);
console.log("[seed] staff admin");
ensureStaffAdmin();
console.log(`[seed] done; ids in ${statePath}`);
