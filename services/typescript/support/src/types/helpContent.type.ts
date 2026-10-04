import type { AutoTopicAction, HelpTopicOrigin, HelpTopicStatus } from "../enums/helpTopic.enum.js";

export interface HelpCategoryRecord {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly position: number;
}

export interface HelpTopicRecord {
  readonly id: string;
  readonly categoryId: string;
  readonly slug: string;
  readonly locale: string;
  readonly title: string;
  readonly summary: string;
  readonly bodyMarkdown: string;
  readonly tags: readonly string[];
  readonly status: HelpTopicStatus;
  readonly origin: HelpTopicOrigin;
  readonly sourceTicketId: string | null;
  readonly mergedIntoTopicId: string | null;
  readonly seedKey: string | null;
  readonly seedHash: string | null;
  readonly editedByStaff: boolean;
  readonly version: number;
  readonly helpfulCount: number;
  readonly notHelpfulCount: number;
  readonly relatedQuestions: number;
  readonly updatedByName: string;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface HelpTopicVersionRecord {
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly bodyMarkdown: string;
  readonly tags: readonly string[];
  readonly editedByName: string;
  readonly changeNote: string;
  readonly createdAt: Date;
}

export interface HelpTopicContent {
  readonly categoryId: string;
  readonly slug: string;
  readonly locale: string;
  readonly title: string;
  readonly summary: string;
  readonly bodyMarkdown: string;
  readonly tags: readonly string[];
}

export interface NewHelpTopic extends HelpTopicContent {
  readonly status: HelpTopicStatus;
  readonly origin: HelpTopicOrigin;
  readonly sourceTicketId: string | null;
  readonly seedKey: string | null;
  readonly seedHash: string | null;
  readonly relatedQuestions?: number;
  readonly editorName: string;
  readonly relatedTopicIds: readonly string[];
}

export interface HelpTopicChange extends Partial<HelpTopicContent> {
  readonly editorName: string;
  readonly changeNote: string;
  readonly markEditedByStaff: boolean;
  readonly relatedTopicIds?: readonly string[];
  readonly relatedQuestionsIncrement?: number;
  readonly seedHash?: string;
}

export interface AdminTopicFilter {
  readonly status: HelpTopicStatus | undefined;
  readonly origin: HelpTopicOrigin | undefined;
  readonly categoryId: string | undefined;
  readonly search: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export interface AutoTopicLogRecord {
  readonly id: string;
  readonly ticketId: string;
  readonly ticketRef: string;
  readonly topicId: string | null;
  readonly action: AutoTopicAction;
  readonly similarity: number;
  readonly writer: string;
  readonly note: string;
  readonly createdAt: Date;
}

export type NewAutoTopicLog = Omit<AutoTopicLogRecord, "id" | "createdAt">;
