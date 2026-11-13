import type { ID, ISODate } from "./primitive.type";
import type { Media } from "./contentModels.type";
import type { ProductSummary } from "./catalogModels.type";
import type { User, UserSummary } from "./identityModels.type";

export interface Story {
  readonly id: ID;
  readonly author: UserSummary;
  readonly media: Media;
  readonly createdAt: ISODate;
  readonly seen: boolean;
}

export interface LiveSession {
  readonly id: ID;
  readonly host: UserSummary & { readonly followers: number; readonly following: number };
  readonly title: string;
  readonly viewers: number;
  readonly status: "live" | "ended";
  readonly products: readonly ProductSummary[];
}

export interface LiveComment {
  readonly id: ID;
  readonly author: UserSummary;
  readonly text: string;
  readonly kind: "comment" | "joined" | "reply" | "gift";
  readonly gift?: { readonly giftId: ID; readonly name: string; readonly emoji: string; readonly quantity: number };
}

export interface AppNotification {
  readonly id: ID;
  readonly title: string;
  readonly body: string;
  readonly createdAt: ISODate;
  readonly read: boolean;
  readonly actor: UserSummary | null;
  readonly url?: string | null;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: User;
  readonly notice?: string | null;
}

