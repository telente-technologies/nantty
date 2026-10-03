import type { SharedContentReference } from "../../models/message.model.js";

export interface GetSharedContentCardQuery {
  readonly viewerId: string;
  readonly reference: SharedContentReference;
}
