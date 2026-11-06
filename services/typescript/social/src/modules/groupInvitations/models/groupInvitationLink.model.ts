export interface GroupInvitationLinkCreatedView {
  readonly id: string;
  readonly conversationId: string;
  /** Returned only when the link is created; the database stores only its SHA-256 hash. */
  readonly token: string;
  readonly expiresAt: string;
}

export interface GroupInvitationLinkPreviewView {
  readonly group: {
    readonly title: string | null;
    readonly memberCount: number;
  };
  readonly expiresAt: string;
}

export interface GroupInvitationLinkRevokedView {
  readonly id: string;
  readonly conversationId: string;
  readonly revokedAt: string;
}

export interface GroupInvitationLinkManagementView {
  readonly id: string;
  readonly conversationId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}
