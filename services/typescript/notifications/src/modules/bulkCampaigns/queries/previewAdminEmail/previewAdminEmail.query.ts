import type { AudienceRequest } from "../../services/audiencePlanner.service.js";

export interface PreviewAdminEmailQuery {
  readonly kind: "TRANSACTIONAL" | "MARKETING";
  readonly subject: string;
  readonly body: string;
  readonly audience: AudienceRequest;
}
