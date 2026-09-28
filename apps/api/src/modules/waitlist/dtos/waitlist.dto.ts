import type { WaitlistEntryRecord } from "../models/waitlist.model.js";

export interface WaitlistEntryDto {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly source: string;
  readonly createdAt: string;
}

export function convertWaitlistEntryToDto(entry: WaitlistEntryRecord): WaitlistEntryDto {
  return { id: entry.id, email: entry.email, name: entry.name, role: entry.role, source: entry.source, createdAt: entry.createdAt.toISOString() };
}
