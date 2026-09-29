export interface AccountSuspensionLookup {
  isAccountSuspended(userId: string, now: Date): Promise<boolean>;
}

export interface AccountSuspensionRequest {
  readonly userId: string;
  readonly actorId: string;
  readonly reason: string;
  readonly endsAt: Date | null;
}

export interface AccountSuspensions extends AccountSuspensionLookup {
  suspendAccount(request: AccountSuspensionRequest): Promise<{ readonly decisionId: string }>;
  liftAccountSuspensions(userId: string, actorId: string, reason: string): Promise<number>;
}
