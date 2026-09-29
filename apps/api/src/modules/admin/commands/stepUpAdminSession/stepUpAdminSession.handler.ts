import { CommandHandler } from "@zudojs/cqrs";

import type { AdminModuleServices } from "../../services/adminModule.service.js";
import type { StepUpAdminSessionCommand } from "./stepUpAdminSession.command.js";

export class StepUpAdminSessionHandler extends CommandHandler<StepUpAdminSessionCommand, { readonly stepUpValidUntil: string }> {
  public readonly commandType = "admin.stepUpAdminSession" as const;

  public constructor(private readonly service: AdminModuleServices) {
    super();
  }

  public async execute(command: StepUpAdminSessionCommand): Promise<{ readonly stepUpValidUntil: string }> {
    const validUntil = await this.service.sessions.stepUp(command.principal, command.proof);
    return { stepUpValidUntil: validUntil.toISOString() };
  }
}
