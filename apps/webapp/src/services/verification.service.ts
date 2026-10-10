import type { MyVerification, VerificationApplicationInput, VerificationCheckout, VerificationPlan } from "@/types/verification.type";

import { createIdempotencyKey, sendListRequestToWebappServer, sendRequestToWebappServer } from "./clientApi.service";

export const verificationShopService = {
  listVerificationPlans: () => sendListRequestToWebappServer<VerificationPlan>("/api/v1/verification/plans"),
  fetchMyVerification: () => sendRequestToWebappServer<MyVerification>("/api/v1/verification/me"),
  submitVerificationApplication: (input: VerificationApplicationInput) =>
    sendRequestToWebappServer<VerificationCheckout>("/api/v1/verification/applications", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("verification") }),
  cancelVerificationSubscription: () =>
    sendRequestToWebappServer<MyVerification>("/api/v1/verification/subscription/cancel", { method: "POST", idempotencyKey: createIdempotencyKey("verification-cancel") }),
};
