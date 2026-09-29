import { afterAll, describe, expect, it } from "vitest";

import type { BlueVerificationTier, PersonalVerificationLookup } from "../../../src/interfaces/creatorEligibility.interface.js";
import { createTestApplication, createTestSettings, type SignedInUser } from "../../fixtures/testApplication.fixture.js";

class FakePersonalVerification implements PersonalVerificationLookup {
  public readonly tiers = new Map<string, BlueVerificationTier>();

  public async findPublicBlueTier(userId: string): Promise<BlueVerificationTier | null> {
    return this.tiers.get(userId) ?? null;
  }
}

const verification = new FakePersonalVerification();
const productionLikeCreatorSettings = { ...createTestSettings().creators, minimumAccountAgeDays: 30, requiredBlueTiers: ["VERIFIED", "PREMIUM"] as const, minimumFollowers: 1, minimumPosts: 1 };
const app = createTestApplication({ settings: { creators: productionLikeCreatorSettings }, external: { personalVerification: verification } });
afterAll(() => app.close());

async function signInAfterMonth(...users: SignedInUser[]): Promise<SignedInUser[]> {
  const accountCreationUsesWallClock = Math.max(0, Date.now() - app.clock.now().getTime());
  app.clock.advanceBySeconds(Math.ceil((accountCreationUsesWallClock + 31 * 86_400_000) / 1000));
  const signedIn: SignedInUser[] = [];
  for (const user of users) {
    const login = await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: user.password }).expect(200);
    signedIn.push({ ...user, accessToken: login.json<{ accessToken: string }>().accessToken });
  }
  return signedIn;
}

interface CriterionBody {
  readonly met: boolean;
  readonly current: unknown;
  readonly required: unknown;
}

describe("creator program", () => {
  it("shows the eligibility checklist and refuses applications listing unmet criteria", async () => {
    const user = await app.registerUser();
    await app.client.get("/api/v1/creators/me").auth(user.accessToken).expect(200).expectJson({ status: "none", canGoLive: false });
    const checklist = (await app.client.get("/api/v1/creators/eligibility").auth(user.accessToken).expect(200)).json<{ eligible: boolean; criteria: Record<string, CriterionBody> }>();
    expect(checklist.eligible).toBe(false);
    expect(checklist.criteria).toMatchObject({
      accountAge: { met: false, required: 30 },
      verifiedEmail: { met: true, current: true, required: true },
      goodStanding: { met: true, current: 0, required: 0 },
      blueVerification: { met: false, current: null, required: ["VERIFIED", "PREMIUM"] },
      followers: { met: false, current: 0, required: 1 },
      posts: { met: false, current: 0, required: 1 },
    });
    const refused = (await app.client.post("/api/v1/creators/applications").auth(user.accessToken).expect(422)).json<{ code: string; unmetCriteria: string[] }>();
    expect(refused.code).toBe("CREATOR_NOT_ELIGIBLE");
    expect(refused.unmetCriteria).toEqual(["accountAge", "blueVerification", "followers", "posts"]);
    await app.client.get("/api/v1/creators/applications/me").auth(user.accessToken).expect(404);

    verification.tiers.set(user.userId, "ESSENTIAL");
    const essential = (await app.client.get("/api/v1/creators/eligibility").auth(user.accessToken).expect(200)).json<{ criteria: Record<string, CriterionBody> }>();
    expect(essential.criteria["blueVerification"]).toMatchObject({ met: false, current: "ESSENTIAL" });
  });

  it("accepts an eligible application, lets only admins review it, and audits the decision", async () => {
    const newcomer = await app.registerUser();
    const follower = await app.registerUser();
    verification.tiers.set(newcomer.userId, "PREMIUM");
    await app.client.post(`/api/v1/users/${newcomer.userId}/follow`).auth(follower.accessToken).expect(200);
    await app.client.post("/api/v1/posts").auth(newcomer.accessToken).send({ text: "My first creator post" }).expect(201);
    const [applicant] = (await signInAfterMonth(newcomer)) as [SignedInUser];
    const admin = await app.registerAdmin();

    const application = (await app.client.post("/api/v1/creators/applications").auth(applicant.accessToken).expect(201)).json<{ id: string; status: string; eligibility: { eligible: boolean } }>();
    expect(application).toMatchObject({ status: "pending", eligibility: { eligible: true } });
    await app.client.post("/api/v1/creators/applications").auth(applicant.accessToken).expect(409);
    await app.client.get("/api/v1/creators/me").auth(applicant.accessToken).expect(200).expectJson({ status: "pending", canGoLive: false });

    await app.client.get("/api/v1/admin/creator-applications?status=pending").auth(applicant.accessToken).expect(403);
    const pending = (await app.client.get("/api/v1/admin/creator-applications?status=pending").auth(admin.accessToken).expect(200)).json<{ data: { id: string }[] }>();
    expect(pending.data.map((item) => item.id)).toContain(application.id);
    await app.client.post(`/api/v1/admin/creator-applications/${application.id}/review`).auth(applicant.accessToken).send({ decision: "approve" }).expect(403);
    await app.client.post(`/api/v1/admin/creator-applications/${application.id}/review`).auth(admin.accessToken).send({ decision: "approve", note: "Welcome" }).expect(200).expectJson({ status: "approved" });
    await app.client.post(`/api/v1/admin/creator-applications/${application.id}/review`).auth(admin.accessToken).send({ decision: "reject" }).expect(409);
    await app.client.get("/api/v1/creators/me").auth(applicant.accessToken).expect(200).expectJson({ status: "approved", canGoLive: true, tier: "standard" });
    await app.client.get("/api/v1/creators/applications/me").auth(applicant.accessToken).expect(200).expectJson({ id: application.id, status: "approved", reviewNote: "Welcome" });

    const audit = (await app.client.get(`/api/v1/admin/audit-events?entityId=${application.id}`).auth(admin.accessToken).expect(200)).json<{ data: { action: string; actorId: string }[] }>();
    expect(audit.data.map((event) => event.action)).toEqual(expect.arrayContaining(["creators.application_submitted", "creators.application_approved"]));

    await app.client.post(`/api/v1/admin/creators/${applicant.userId}/suspend`).auth(admin.accessToken).send({ reason: "Fake giveaways" }).expect(200).expectJson({ status: "suspended" });
    await app.client.post(`/api/v1/admin/creators/${applicant.userId}/suspend`).auth(admin.accessToken).send({}).expect(409);
    const suspendedChecklist = (await app.client.get("/api/v1/creators/eligibility").auth(applicant.accessToken).expect(200)).json<{ criteria: Record<string, CriterionBody> }>();
    expect(suspendedChecklist.criteria["goodStanding"]).toMatchObject({ met: false, current: 1 });
    const standingAudit = (await app.client.get(`/api/v1/admin/audit-events?entityId=${applicant.userId}`).auth(admin.accessToken).expect(200)).json<{ data: { action: string }[] }>();
    expect(standingAudit.data.map((event) => event.action)).toContain("creators.suspended");
  });

  it("records a rejection so the applicant can see it", async () => {
    const newcomer = await app.registerUser();
    const follower = await app.registerUser();
    verification.tiers.set(newcomer.userId, "VERIFIED");
    await app.client.post(`/api/v1/users/${newcomer.userId}/follow`).auth(follower.accessToken).expect(200);
    await app.client.post("/api/v1/posts").auth(newcomer.accessToken).send({ text: "hello" }).expect(201);
    const [applicant] = (await signInAfterMonth(newcomer)) as [SignedInUser];
    const admin = await app.registerAdmin();
    const application = (await app.client.post("/api/v1/creators/applications").auth(applicant.accessToken).expect(201)).json<{ id: string }>();
    await app.client.post(`/api/v1/admin/creator-applications/${application.id}/review`).auth(admin.accessToken).send({ decision: "reject", note: "Too new" }).expect(200);
    await app.client.get("/api/v1/creators/me").auth(applicant.accessToken).expect(200).expectJson({ status: "rejected", canGoLive: false });
    await app.client.post("/api/v1/lives").auth(applicant.accessToken).send({ title: "Not yet" }).expect(403);
    await app.client.get("/api/v1/creators/dashboard").auth(applicant.accessToken).expect(403);
  });
});
