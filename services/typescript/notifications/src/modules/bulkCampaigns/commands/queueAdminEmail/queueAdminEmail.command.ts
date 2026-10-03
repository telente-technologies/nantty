import type { AudienceRequest } from "../../services/audiencePlanner.service.js";

export interface StaffActor {
  readonly id: string;
  readonly name: string;
}

export interface QueueAdminEmailCommand {
  readonly kind: "TRANSACTIONAL" | "MARKETING";
  readonly subject: string;
  readonly body: string;
  readonly audience: AudienceRequest;
  readonly reason: string;
  readonly actor: StaffActor;
}
