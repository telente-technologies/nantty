import type { ID } from "@/types";

import { api, generateIdempotencyKey } from "./apiClient.service";

export type ReportTargetType = "post" | "clip" | "comment" | "live" | "space" | "user" | "product" | "message" | "sound";

export type ReportReason =
  | "spam"
  | "scam_or_fraud"
  | "counterfeit_product"
  | "nudity_or_sexual_content"
  | "hate_or_harassment"
  | "violence"
  | "intellectual_property"
  | "something_else";

export type LiveReportReason =
  | "child_safety"
  | "self_harm"
  | "violence"
  | "sexual_content"
  | "hate"
  | "harassment"
  | "scam"
  | "intellectual_property"
  | "other";

export interface LiveReportContext {
  readonly offsetSeconds?: number;
  readonly frameRef?: string;
  readonly capturedAt?: string;
}

export interface NewReportInput {
  readonly targetType: ReportTargetType;
  readonly targetId: ID;
  readonly reason: ReportReason | LiveReportReason;
  readonly details: string;
  readonly liveContext?: LiveReportContext;
}

export interface SubmittedReport {
  readonly id: ID;
  readonly status: "received";
}

export const REPORT_REASON_OPTIONS: readonly { readonly reason: ReportReason; readonly label: string }[] = [
  { reason: "spam", label: "Spam" },
  { reason: "scam_or_fraud", label: "Scam or fraud" },
  { reason: "counterfeit_product", label: "Counterfeit or fake product" },
  { reason: "nudity_or_sexual_content", label: "Nudity or sexual content" },
  { reason: "hate_or_harassment", label: "Hate or harassment" },
  { reason: "violence", label: "Violence" },
  { reason: "intellectual_property", label: "Copyright / intellectual property" },
  { reason: "something_else", label: "Something else" },
];

export const MAXIMUM_REPORT_DETAILS_LENGTH = 500;

export const reportsService = {
  submitReportForContent: (input: NewReportInput, idempotencyKey: string = generateIdempotencyKey()) =>
    api.post<SubmittedReport>("/api/v1/reports", input, { idempotencyKey }),
};
