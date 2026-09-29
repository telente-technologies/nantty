import type { SignedInUser, TestApplication } from "../../fixtures/testApplication.fixture.js";

export async function approveCreator(app: TestApplication, user: SignedInUser, admin?: SignedInUser): Promise<string> {
  const reviewer = admin ?? (await app.registerAdmin());
  const application = (await app.client.post("/api/v1/creators/applications").auth(user.accessToken).expect(201)).json<{ id: string }>();
  await app.client.post(`/api/v1/admin/creator-applications/${application.id}/review`).auth(reviewer.accessToken).send({ decision: "approve" }).expect(200);
  return application.id;
}

export async function registerApprovedCreator(app: TestApplication, kind: "user" | "seller" = "user"): Promise<SignedInUser> {
  const creator = kind === "seller" ? await app.registerSeller() : await app.registerUser();
  await approveCreator(app, creator);
  return creator;
}
