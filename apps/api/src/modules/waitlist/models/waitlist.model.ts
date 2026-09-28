export type WaitlistRole = "buyer" | "seller";

export interface WaitlistEntryRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: WaitlistRole;
  readonly source: string;
  readonly createdAt: Date;
}

export type NewWaitlistEntry = Omit<WaitlistEntryRecord, "id" | "createdAt">;
