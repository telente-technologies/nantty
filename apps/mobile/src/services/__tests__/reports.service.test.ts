jest.mock("../core/apiClient.service", () => ({
  api: { post: jest.fn() },
  generateIdempotencyKey: jest.fn(() => "report-test-key"),
}));

import { api } from "../core/apiClient.service";
import { reportsService } from "../moderation/reports.service";

const mockedApi = api as jest.Mocked<typeof api>;

describe("reportsService moderation contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("includes reportedUserId when a user account is the target", async () => {
    await reportsService.submitReportForContent({
      targetType: "user",
      targetId: "account-42",
      reportedUserId: "account-42",
      reason: "hate_or_harassment",
      details: "Repeated harassment",
    }, "story-report-key");

    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/reports", {
      targetType: "user",
      targetId: "account-42",
      reportedUserId: "account-42",
      reason: "hate_or_harassment",
      details: "Repeated harassment",
    }, { idempotencyKey: "story-report-key" });
  });

  it("does not add user-only report fields to other target types", async () => {
    await reportsService.submitReportForContent({
      targetType: "post",
      targetId: "post-42",
      reason: "spam",
      details: "",
    }, "post-report-key");

    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/reports", {
      targetType: "post",
      targetId: "post-42",
      reason: "spam",
      details: "",
    }, { idempotencyKey: "post-report-key" });
  });

  it("submits a store report through the shared moderation endpoint", async () => {
    await reportsService.submitReportForContent({
      targetType: "store",
      targetId: "store-42",
      reason: "scam_or_fraud",
      details: "The store is advertising a counterfeit item.",
    }, "store-report-key");

    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/reports", {
      targetType: "store",
      targetId: "store-42",
      reason: "scam_or_fraud",
      details: "The store is advertising a counterfeit item.",
    }, { idempotencyKey: "store-report-key" });
  });
});
