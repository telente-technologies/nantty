export type HelpTopicStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "UNPUBLISHED" | "MERGED";
export type HelpTopicOrigin = "EDITORIAL" | "SEED" | "RESOLVED_QUESTION";
export type AutoTopicAction = "CREATED" | "APPENDED" | "PENDING_REVIEW" | "SKIPPED";

export interface HelpCategory {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly position: number;
  readonly topicCount: number;
}

export interface HelpTopic {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly categoryId: string;
  readonly categorySlug: string;
  readonly categoryTitle: string;
  readonly tags: readonly string[];
  readonly bodyMarkdown: string;
  readonly status: HelpTopicStatus;
  readonly origin: HelpTopicOrigin;
  readonly fromResolvedQuestion: boolean;
  readonly sourceTicketId: string | null;
  readonly mergedIntoTopicId: string | null;
  readonly editedByStaff: boolean;
  readonly version: number;
  readonly helpfulCount: number;
  readonly notHelpfulCount: number;
  readonly relatedQuestions: number;
  readonly updatedByName: string;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HelpTopicVersion {
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly bodyMarkdown: string;
  readonly tags: readonly string[];
  readonly editedByName: string;
  readonly changeNote: string;
  readonly createdAt: string;
}

export interface HelpTopicDetail {
  readonly topic: HelpTopic;
  readonly versions: readonly HelpTopicVersion[];
  readonly relatedTopicIds: readonly string[];
}

export interface AutoTopicLogEntry {
  readonly id: string;
  readonly ticketId: string;
  readonly ticketRef: string;
  readonly action: AutoTopicAction;
  readonly similarity: number;
  readonly writer: string;
  readonly note: string;
  readonly createdAt: string;
  readonly topic: HelpTopic | null;
}

export interface HelpTopicInput {
  readonly categoryId: string;
  readonly slug?: string;
  readonly title: string;
  readonly summary?: string;
  readonly bodyMarkdown: string;
  readonly tags: readonly string[];
  readonly relatedTopicIds: readonly string[];
  readonly status?: "DRAFT" | "PUBLISHED";
  readonly changeNote?: string;
}

export interface HelpCategoryInput {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly position: number;
}

export interface HelpSettings {
  readonly autoFaqRequiresReview: boolean;
}
