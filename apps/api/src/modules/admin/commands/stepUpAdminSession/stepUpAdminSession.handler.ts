import { CommandHandler } from "@zudojs/cqrs";

import type { AdminServices } from "../../services/adminServices.service.js";
import type { StepUpAdminSessionCommand } from "./stepUpAdminSession.command.js";

export class StepUpAdminSessionHandler extends CommandHandler<StepUpAdminSessionCommand, { readonly stepUpToken: string; readonly expiresIn: number }> {
  public readonly commandType = "admin.stepUpAdminSession" as const;

  public constructor(private readonly service: AdminServices) {
    super();
  }

  public execute(command: StepUpAdminSessionCommand): Promise<{ readonly stepUpToken: string; readonly expiresIn: number }> {
    return this.service.signIn.stepUp(command.staff.account, command.staff.session, command.proof);
  }
}
