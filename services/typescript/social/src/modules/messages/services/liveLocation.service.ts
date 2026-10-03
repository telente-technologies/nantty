import { conflict, forbidden, unprocessable } from "../../../errors/social.error.js";
import type { SharedLocation } from "../models/message.model.js";
import type { MessageRow } from "../repositories/message.repository.js";

export function assertLiveLocationEditableBy(row: MessageRow, viewerId: string, now: Date): SharedLocation {
  if (row.kind !== "liveLocation" || row.location === null) throw unprocessable("NOT_A_LIVE_LOCATION", "This message isn't a live location.");
  if (row.senderId !== viewerId) throw forbidden("NOT_MESSAGE_SENDER", "Only the sender can update this location.");
  const location = row.location as unknown as SharedLocation;
  if (location.liveUntil === undefined || location.liveUntil === null || new Date(location.liveUntil) <= now) throw conflict("LIVE_LOCATION_ENDED", "Live location sharing has ended.");
  return location;
}
