export interface SecuritySession {
  readonly id: string;
  readonly device: string;
  readonly app: "dashboard" | "mobile_app";
  readonly location: string;
  readonly ipAddress: string;
  readonly signedInAt: string;
  readonly lastActiveAt: string;
  readonly isCurrent: boolean;
}

export interface LoginHistoryEntry {
  readonly id: string;
  readonly outcome: "success" | "wrong_password" | "blocked";
  readonly device: string;
  readonly location: string;
  readonly ipAddress: string;
  readonly occurredAt: string;
}

export interface SecurityOverview {
  readonly twoStepVerification: { readonly enabled: boolean; readonly method: "authenticator_app" | "email" | null; readonly enabledAt: string | null };
  readonly passwordChangedAt: string | null;
  readonly sessions: SecuritySession[];
  readonly loginHistory: LoginHistoryEntry[];
}
