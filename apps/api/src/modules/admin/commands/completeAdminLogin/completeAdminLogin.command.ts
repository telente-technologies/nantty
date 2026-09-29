import { Command } from "@zudojs/cqrs";

import type { ClientDetails } from "../../../auth/models/auth.model.js";
import type { SecondFactorProof } from "../../services/staffMfa.service.js";

export class CompleteAdminLoginCommand extends Command<"admin.completeAdminLogin"> {
  public constructor(
    public readonly challengeToken: string,
    public readonly proof: SecondFactorProof,
    public readonly client: ClientDetails,
  ) {
    super("admin.completeAdminLogin");
  }
}
