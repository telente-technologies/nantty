import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ReviewVerificationCommand extends Command<"verifications.reviewVerification"> {
  public constructor(
    public readonly principal: Principal,
    public readonly profileId: string,
    public readonly decision: "approve" | "reject" | "suspend" | "revoke",
    public readonly reason: string | undefined,
  ) {
    super("verifications.reviewVerification");
  }
}
