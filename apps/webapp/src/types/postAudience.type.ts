export type ReplyPolicy = "everyone" | "following" | "followers" | "mentioned" | "off";

export type SensitiveLabel = "nudity" | "graphic_violence" | "dangerous_acts" | "self_harm";

export type ReplyRestrictionReason = "SIGN_IN_REQUIRED" | "REPLIES_OFF" | "AUTHOR_FOLLOWS_ONLY" | "FOLLOWERS_ONLY" | "MENTIONED_ONLY" | "SUBSCRIBERS_ONLY";

export interface ReplyRestriction {
  readonly reason: ReplyRestrictionReason;
  readonly message: string;
}

export interface SensitiveContent {
  readonly labels: readonly SensitiveLabel[];
  readonly requiresInterstitial: boolean;
}

export interface ContentPreferences {
  readonly showSensitiveWithoutWarning: boolean;
  readonly canChangeSensitiveContentSetting: boolean;
  readonly ageBracket: "adult" | "minor" | "unknown";
}
