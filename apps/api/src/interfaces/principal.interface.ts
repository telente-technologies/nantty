export interface Principal {
  readonly userId: string;
  readonly roles: readonly string[];
  readonly sessionId: string;
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<Principal>;
}
