import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { StreakView } from "../../streaks/services/streakEngine.service.js";

export type InboxFolderName = "chats" | "requests" | "spam";
export type ConversationKindName = "direct" | "group" | "channel" | "business";
export type MemberRoleName = "owner" | "admin" | "member" | "subscriber";

export interface ConversationView {
  readonly id: string;
  readonly peer: UserSummary;
  readonly lastMessage: string;
  readonly lastMessageKind: string | null;
  readonly lastMessageAt: string;
  readonly unread: number;
  readonly isFriend: boolean;
  readonly kind: ConversationKindName;
  readonly title: string | null;
  readonly description: string | null;
  readonly photoUrl: string | null;
  readonly photoMediaId: string | null;
  readonly memberCount: number;
  readonly myRole: MemberRoleName;
  readonly disappearingMessagesSeconds: number | null;
  readonly onlyAdminsCanMentionAll: boolean;
  readonly store: null;
  readonly inboxFolder: InboxFolderName;
  readonly spamReason: string | null;
  readonly streak: StreakView | null;
  readonly mutedUntil: string | null;
}

export interface ConversationMemberView {
  readonly user: UserSummary;
  readonly role: "owner" | "admin" | "member";
}
