import type { ID, ISODate } from "./models.type";

export interface HelpCategory {
  readonly id: ID;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly topicCount: number;
}

export interface HelpTopicSummary {
  readonly id: ID;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly categorySlug: string;
  readonly categoryTitle: string;
  readonly tags: readonly string[];
  readonly fromResolvedQuestion: boolean;
  readonly sourceLabel: string | null;
  readonly updatedAt: ISODate;
}

export interface HelpTopicDetail extends HelpTopicSummary {
  readonly bodyMarkdown: string;
  readonly version: number;
  readonly helpfulCount: number;
  readonly notHelpfulCount: number;
  readonly relatedQuestions: number;
  readonly publishedAt: ISODate | null;
  readonly related: readonly HelpTopicSummary[];
  readonly viewerVote: boolean | null;
  readonly redirectedFromSlug: string | null;
}

export interface HelpVoteResult {
  readonly helpfulCount: number;
  readonly notHelpfulCount: number;
  readonly viewerVote: boolean;
}
