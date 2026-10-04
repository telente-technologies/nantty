export const helpTopicStatuses = ["draft", "pending_review", "published", "unpublished", "merged"] as const;
export type HelpTopicStatus = (typeof helpTopicStatuses)[number];

export const helpTopicOrigins = ["editorial", "seed", "resolved_question"] as const;
export type HelpTopicOrigin = (typeof helpTopicOrigins)[number];

export const autoTopicActions = ["created", "appended", "pending_review", "skipped"] as const;
export type AutoTopicAction = (typeof autoTopicActions)[number];
