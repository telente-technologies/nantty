import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ProfileType } from "../../../../interfaces/verificationBadge.interface.js";

export class GetMyVerificationQuery extends Query<"verifications.getMyVerification"> {
  public constructor(
    public readonly principal: Principal,
    public readonly profileType: ProfileType,
    public readonly storeId: string | undefined,
  ) {
    super("verifications.getMyVerification");
  }
}
