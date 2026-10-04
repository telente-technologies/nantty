import type { HelpTopicStatus } from "../enums/helpTopic.enum.js";
import type {
  AdminTopicFilter, AutoTopicLogRecord, HelpCategoryRecord, HelpTopicChange, HelpTopicRecord, HelpTopicVersionRecord, NewAutoTopicLog, NewHelpTopic,
} from "../types/helpContent.type.js";

export type HelpCategoryInput = Omit<HelpCategoryRecord, "id">;

export interface HelpContentStore {
  listCategories(): Promise<readonly HelpCategoryRecord[]>;
  countPublishedTopicsByCategory(locale: string): Promise<ReadonlyMap<string, number>>;
  findCategoryBySlug(slug: string): Promise<HelpCategoryRecord | null>;
  findCategoryById(categoryId: string): Promise<HelpCategoryRecord | null>;
  createCategory(input: HelpCategoryInput): Promise<HelpCategoryRecord>;
  updateCategory(categoryId: string, input: HelpCategoryInput): Promise<HelpCategoryRecord | null>;
  deleteCategory(categoryId: string): Promise<"deleted" | "missing" | "has_topics">;
  listTopicsInCategory(categoryId: string, locale: string, statuses: readonly HelpTopicStatus[]): Promise<readonly HelpTopicRecord[]>;
  findTopicCandidates(keywords: readonly string[], locale: string, statuses: readonly HelpTopicStatus[], limit: number): Promise<readonly HelpTopicRecord[]>;
  findTopicBySlug(slug: string, locale: string): Promise<HelpTopicRecord | null>;
  findTopicById(topicId: string): Promise<HelpTopicRecord | null>;
  findTopicBySeedKey(seedKey: string): Promise<HelpTopicRecord | null>;
  listTopicsByIds(topicIds: readonly string[]): Promise<readonly HelpTopicRecord[]>;
  listRelatedTopicIds(topicId: string): Promise<readonly string[]>;
  createTopic(input: NewHelpTopic): Promise<HelpTopicRecord>;
  updateTopic(topicId: string, change: HelpTopicChange): Promise<HelpTopicRecord | null>;
  setTopicStatus(topicId: string, status: HelpTopicStatus, editorName: string, mergedIntoTopicId?: string | null): Promise<HelpTopicRecord | null>;
  deleteTopic(topicId: string): Promise<boolean>;
  listTopicVersions(topicId: string): Promise<readonly HelpTopicVersionRecord[]>;
  listAdminTopics(filter: AdminTopicFilter): Promise<{ readonly items: readonly HelpTopicRecord[]; readonly total: number }>;
  recordVote(topicId: string, voterKey: string, helpful: boolean): Promise<HelpTopicRecord | null>;
  findVote(topicId: string, voterKey: string): Promise<boolean | null>;
  createAutoTopicLog(entry: NewAutoTopicLog): Promise<AutoTopicLogRecord>;
  listAutoTopicLogs(page: number, pageSize: number): Promise<{ readonly items: readonly AutoTopicLogRecord[]; readonly total: number }>;
  readSetting<T>(key: string, fallback: T): Promise<T>;
  writeSetting(key: string, value: unknown, updatedBy: string): Promise<void>;
}
