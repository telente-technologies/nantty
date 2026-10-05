import { callApi, createSuperadmin, describeResponse, stepUpStaff, type StaffActor, type UserActor } from "../smokeBridge.js";

async function relaxCreatorThresholds(staff: StaffActor): Promise<() => Promise<void>> {
  const current = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
  if (current.status !== 200) throw new Error(`creator thresholds: ${describeResponse(current)}`);
  const original = current.body.value;
  const value = { ...original, autoApprove: { ...original.autoApprove, minimumAccountAgeDays: 0, requiresVerifiedPhone: false, minimumRealFollowers: 0, minimumOriginalPostsInLast60Days: 0 }, manualReview: { ...original.manualReview, minimumRealFollowers: 0 } };
  const relaxed = await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value, expectedVersion: current.body.version, reason: "Browser e2e needs instant creators" } });
  if (relaxed.status !== 200) throw new Error(`relax thresholds: ${describeResponse(relaxed)}`);
  return async () => {
    const latest = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
    await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: original, expectedVersion: latest.body.version, reason: "Restore after browser e2e" } });
  };
}

export async function promoteToCreator(user: UserActor, applyThroughApi = true): Promise<{ readonly staff: StaffActor; readonly restore: () => Promise<void> }> {
  const staff = await createSuperadmin();
  const restore = await relaxCreatorThresholds(staff);
  if (applyThroughApi) await callApi("POST", "/api/v1/users/me/creator-application", { token: user.accessToken, body: {} });
  await approvePendingCreator(user, staff);
  return { staff, restore };
}

export async function approvePendingCreator(user: UserActor, staff: StaffActor): Promise<void> {
  const mine = await callApi("GET", "/api/v1/creators/applications/me", { token: user.accessToken });
  if (/pending/.test(JSON.stringify(mine.body))) await callApi("POST", `/api/v1/admin/applications/creators/${mine.body.id ?? mine.body.application?.id}/approve`, { token: staff.accessToken, body: { reason: "Browser e2e approval" } });
}

export async function createSubscriptionPlan(creator: UserActor, name: string, amountMinor = 150_000): Promise<string> {
  const login = await callApi("POST", "/api/v1/auth/refresh", { body: { refreshToken: creator.refreshToken } });
  const token = login.body?.accessToken ?? creator.accessToken;
  const created = await callApi("POST", "/api/v1/creators/me/subscription-plans", { token, body: { name, description: "Browser e2e plan", price: { amountMinor, currency: "NGN" }, interval: "month", benefits: [{ name: "Shout-out", description: "Monthly shout-out" }] } });
  if (created.status !== 201 && created.status !== 200) throw new Error(`plan: ${describeResponse(created)}`);
  return created.body.id ?? created.body.plan?.id;
}
