export type UserStatus = "active" | "deactivated";
export type ThemePreference = "system" | "light" | "dark";

export const NOTIFICATION_CATEGORIES = ["orders", "payments", "social", "messages", "promotions", "live"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface UserSettings {
  readonly theme: ThemePreference;
  readonly language: string;
  readonly notifications: Readonly<Record<NotificationCategory, boolean>>;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: "system",
  language: "en",
  notifications: { orders: true, payments: true, social: true, messages: true, promotions: false, live: true },
};

export interface UserRecord {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly username: string;
  readonly passwordHash: string | null;
  readonly name: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly bannerUrl: string | null;
  readonly birthday: Date | null;
  readonly roles: readonly string[];
  readonly status: UserStatus;
  readonly emailVerifiedAt: Date | null;
  readonly phoneVerifiedAt: Date | null;
  readonly settings: UserSettings;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewUserInput {
  readonly email: string | null;
  readonly phone: string | null;
  readonly username: string;
  readonly passwordHash: string | null;
  readonly name: string;
  readonly birthday: Date | null;
  readonly roles: readonly string[];
  readonly emailVerifiedAt?: Date | null;
}

export interface ProfileChanges {
  readonly name?: string;
  readonly bio?: string;
  readonly username?: string;
  readonly avatarUrl?: string | null;
  readonly bannerUrl?: string | null;
}

export interface AddressRecord {
  readonly id: string;
  readonly userId: string;
  readonly label: string;
  readonly fullName: string;
  readonly phoneEncrypted: string;
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly postalCode: string;
  readonly isDefault: boolean;
  readonly createdAt: Date;
}

export type AddressFields = Omit<AddressRecord, "id" | "userId" | "createdAt">;

export interface TopicRecord {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly order: number;
}

export function parseUserSettings(value: unknown): UserSettings {
  const input = (typeof value === "object" && value !== null ? value : {}) as Partial<UserSettings>;
  return {
    theme: input.theme ?? DEFAULT_USER_SETTINGS.theme,
    language: input.language ?? DEFAULT_USER_SETTINGS.language,
    notifications: { ...DEFAULT_USER_SETTINGS.notifications, ...(input.notifications ?? {}) },
  };
}
