import { sendRequestToWebappServer } from "@/services/clientApi.service";

export interface HumanVerificationResult {
  readonly verified: boolean;
  readonly requirement: "none" | "once" | "everyAction";
  readonly clearedUntil: string | null;
}

export function submitHumanVerificationToken(token: string): Promise<HumanVerificationResult> {
  return sendRequestToWebappServer<HumanVerificationResult>("/api/v1/security/human-verification", { method: "POST", body: { token }, skipHumanVerification: true });
}
