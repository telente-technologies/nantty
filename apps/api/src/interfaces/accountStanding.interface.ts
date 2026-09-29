export interface AccountSuspensionLookup {
  isAccountSuspended(userId: string, now: Date): Promise<boolean>;
}
