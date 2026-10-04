export interface RequesterProfile {
  readonly accountId: string;
  readonly displayName: string;
  readonly username: string;
  readonly emailMasked: string;
  readonly status: string;
}

export interface StaffAuditEntry {
  readonly action: string;
  readonly actorId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly reason: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface IdentityDirectory {
  findRequesterProfile(accountId: string): Promise<RequesterProfile | null>;
  recordStaffAudit(entry: StaffAuditEntry): Promise<void>;
}

export const offlineIdentityDirectory: IdentityDirectory = {
  findRequesterProfile: async () => null,
  recordStaffAudit: async () => undefined,
};
