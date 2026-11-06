import type { ReengagementRepository } from "../../../../interfaces/reengagementRepository.interface.js";

export class RecordActivityHandler {
  public constructor(private readonly reengagement: ReengagementRepository, private readonly now: () => Date = () => new Date()) {}

  public async execute(command: { readonly accountId: string; readonly timeZone: string }): Promise<void> {
    await this.reengagement.recordActivity(command.accountId, command.timeZone, this.now());
  }
}
