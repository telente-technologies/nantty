import type { StaffActor } from "../queueAdminEmail/queueAdminEmail.command.js";

export interface QueueLegalNoticeCommand {
  readonly versionId: string;
  readonly reason: string;
  readonly actor: StaffActor;
}
