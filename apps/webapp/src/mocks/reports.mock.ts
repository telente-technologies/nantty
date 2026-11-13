import { ApiError } from "@/errors/api.error";

import { isChatReportBody, submitChatReportMock } from "./chatReports.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const VALID_REPORT_TARGET_TYPES = ["post", "clip", "comment", "live", "space", "user", "product", "message"];
const receivedReports: { id: string; targetType: string; targetId: string; reason: string; details: string }[] = [];
export const receivedMockFeedFeedback: { postId: string; type?: string; kind?: string }[] = [];

export const reportsMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/reports", ({ body }) => {
    if (isChatReportBody(body)) return submitChatReportMock(body);
    const input = body as { targetType: string; targetId: string; reason: string; details?: string };
    if (!VALID_REPORT_TARGET_TYPES.includes(input.targetType) || !input.targetId || !input.reason) {
      throw new ApiError(422, "Please choose a reason for your report", "INVALID_REPORT");
    }
    const report = { id: `rep_${Date.now().toString(36)}`, ...input, details: (input.details ?? "").slice(0, 500) };
    receivedReports.push(report);
    return { id: report.id, status: "received" };
  }),
  createMockRoute("POST", "/api/v1/feeds/feedback", ({ body }) => {
    const input = body as { postId: string; type?: string; kind?: string };
    if (!["hide", "not_interested", "notInterested", "less", "more", "like"].includes(input.kind ?? input.type ?? "")) throw new ApiError(422, "Unknown feedback type", "INVALID_FEEDBACK");
    receivedMockFeedFeedback.push(input);
  }),
];
