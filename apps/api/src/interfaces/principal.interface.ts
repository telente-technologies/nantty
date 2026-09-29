export interface Principal {
  readonly userId: string;
  readonly roles: readonly string[];
  readonly sessionId: string;
  readonly sessionKind?: "user" | "admin";
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<Principal>;
}
