import { creatorProgramService } from "../creators/creatorProgram.service";

const mockPost = jest.fn();

jest.mock("../core/apiClient.service", () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));

describe("creator program service", () => {
  beforeEach(() => mockPost.mockReset());

  it("submits the React Native creator application with its retry-stable idempotency key", async () => {
    const input = {
      contentCategories: ["tech"] as const,
      socialLinks: [{ platform: "youtube", url: "https://youtube.com/@creator" }] as const,
      sampleContentUrls: ["https://media.nantty.com/sample.jpg"] as const,
      payoutAccountId: "payout-1",
      acceptedCreatorTermsVersion: "2026-09",
    };
    mockPost.mockResolvedValue({ id: "application-1", status: "pending" });

    await creatorProgramService.submitCreatorApplication(input, "creator-application-key-1");

    expect(mockPost).toHaveBeenCalledWith("/api/v1/creators/applications", input, { idempotencyKey: "creator-application-key-1" });
  });
});
