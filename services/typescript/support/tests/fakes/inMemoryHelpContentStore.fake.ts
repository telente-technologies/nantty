import { randomUUID } from "node:crypto";

import type { HelpContentStore, HelpCategoryInput } from "../../src/interfaces/helpContentStore.interface.js";
import type { HelpTopicStatus } from "../../src/enums/helpTopic.enum.js";
import type { AutoTopicLogRecord, HelpCategoryRecord, HelpTopicChange, HelpTopicRecord, HelpTopicVersionRecord, NewAutoTopicLog, NewHelpTopic } from "../../src/types/helpContent.type.js";
import { buildTopicSearchText } from "../../src/modules/helpContent/repositories/helpTopic.prisma.repository.js";

type MutableTopic = { -readonly [Key in keyof HelpTopicRecord]: HelpTopicRecord[Key] } & { searchText: string };

export class InMemoryHelpContentStore implements HelpContentStore {
  public readonly categories = new Map<string, HelpCategoryRecord>();
  public readonly topics = new Map<string, MutableTopic>();
  public readonly versions = new Map<string, HelpTopicVersionRecord[]>();
  public readonly relations = new Map<string, string[]>();
  public readonly votes = new Map<string, boolean>();
  public readonly logs: AutoTopicLogRecord[] = [];
  public readonly settings = new Map<string, unknown>();

  private copy(topic: MutableTopic): HelpTopicRecord {
    const { searchText: _searchText, ...rest } = topic;
    return structuredClone(rest);
  }

  public async listCategories() {
    return [...this.categories.values()].sort((first, second) => first.position - second.position);
  }

  public async countPublishedTopicsByCategory(locale: string) {
    const counts = new Map<string, number>();
    for (const topic of this.topics.values()) if (topic.status === "published" && topic.locale === locale) counts.set(topic.categoryId, (counts.get(topic.categoryId) ?? 0) + 1);
    return counts;
  }

  public async findCategoryBySlug(slug: string) {
    return [...this.categories.values()].find((category) => category.slug === slug) ?? null;
  }

  public async findCategoryById(categoryId: string) {
    return this.categories.get(categoryId) ?? null;
  }

  public async createCategory(input: HelpCategoryInput) {
    const category = { id: randomUUID(), ...input };
    this.categories.set(category.id, category);
    return category;
  }

  public async updateCategory(categoryId: string, input: HelpCategoryInput) {
    if (!this.categories.has(categoryId)) return null;
    const category = { id: categoryId, ...input };
    this.categories.set(categoryId, category);
    return category;
  }

  public async deleteCategory(categoryId: string) {
    if (!this.categories.has(categoryId)) return "missing" as const;
    if ([...this.topics.values()].some((topic) => topic.categoryId === categoryId)) return "has_topics" as const;
    this.categories.delete(categoryId);
    return "deleted" as const;
  }

  public async listTopicsInCategory(categoryId: string, locale: string, statuses: readonly HelpTopicStatus[]) {
    return [...this.topics.values()].filter((topic) => topic.categoryId === categoryId && topic.locale === locale && statuses.includes(topic.status)).map((topic) => this.copy(topic));
  }

  public async findTopicCandidates(keywords: readonly string[], locale: string, statuses: readonly HelpTopicStatus[], limit: number) {
    return [...this.topics.values()]
      .filter((topic) => topic.locale === locale && statuses.includes(topic.status) && (keywords.length === 0 || keywords.some((keyword) => topic.searchText.includes(keyword) || topic.tags.includes(keyword))))
      .slice(0, limit).map((topic) => this.copy(topic));
  }

  public async findTopicBySlug(slug: string, locale: string) {
    const topic = [...this.topics.values()].find((entry) => entry.slug === slug && entry.locale === locale);
    return topic === undefined ? null : this.copy(topic);
  }

  public async findTopicById(topicId: string) {
    const topic = this.topics.get(topicId);
    return topic === undefined ? null : this.copy(topic);
  }

  public async findTopicBySeedKey(seedKey: string) {
    const topic = [...this.topics.values()].find((entry) => entry.seedKey === seedKey);
    return topic === undefined ? null : this.copy(topic);
  }

  public async listTopicsByIds(topicIds: readonly string[]) {
    return topicIds.flatMap((id) => (this.topics.has(id) ? [this.copy(this.topics.get(id)!)] : []));
  }

  public async listRelatedTopicIds(topicId: string) {
    return this.relations.get(topicId) ?? [];
  }

  public async createTopic(input: NewHelpTopic) {
    const now = new Date();
    const topic: MutableTopic = {
      id: randomUUID(), categoryId: input.categoryId, slug: input.slug, locale: input.locale, title: input.title, summary: input.summary, bodyMarkdown: input.bodyMarkdown, tags: [...input.tags],
      status: input.status, origin: input.origin, sourceTicketId: input.sourceTicketId, mergedIntoTopicId: null, seedKey: input.seedKey, seedHash: input.seedHash, editedByStaff: false, version: 1,
      helpfulCount: 0, notHelpfulCount: 0, relatedQuestions: input.relatedQuestions ?? 0, updatedByName: input.editorName, publishedAt: input.status === "published" ? now : null, createdAt: now, updatedAt: now,
      searchText: buildTopicSearchText(input.title, input.summary, input.tags, input.bodyMarkdown),
    };
    this.topics.set(topic.id, topic);
    this.versions.set(topic.id, [{ version: 1, title: topic.title, summary: topic.summary, bodyMarkdown: topic.bodyMarkdown, tags: topic.tags, editedByName: input.editorName, changeNote: "Created", createdAt: now }]);
    this.relations.set(topic.id, input.relatedTopicIds.filter((id) => this.topics.has(id)));
    return this.copy(topic);
  }

  public async updateTopic(topicId: string, change: HelpTopicChange) {
    const topic = this.topics.get(topicId);
    if (topic === undefined) return null;
    const before = JSON.stringify([topic.title, topic.summary, topic.bodyMarkdown, topic.tags]);
    Object.assign(topic, Object.fromEntries(Object.entries({ categoryId: change.categoryId, slug: change.slug, title: change.title, summary: change.summary, bodyMarkdown: change.bodyMarkdown, tags: change.tags === undefined ? undefined : [...change.tags], seedHash: change.seedHash }).filter(([, value]) => value !== undefined)));
    if (change.markEditedByStaff) topic.editedByStaff = true;
    if (change.relatedQuestionsIncrement !== undefined) topic.relatedQuestions += change.relatedQuestionsIncrement;
    if (change.relatedTopicIds !== undefined) this.relations.set(topicId, [...change.relatedTopicIds]);
    if (JSON.stringify([topic.title, topic.summary, topic.bodyMarkdown, topic.tags]) !== before) {
      topic.version += 1;
      this.versions.get(topicId)?.unshift({ version: topic.version, title: topic.title, summary: topic.summary, bodyMarkdown: topic.bodyMarkdown, tags: topic.tags, editedByName: change.editorName, changeNote: change.changeNote, createdAt: new Date() });
    }
    topic.updatedByName = change.editorName;
    topic.searchText = buildTopicSearchText(topic.title, topic.summary, topic.tags, topic.bodyMarkdown);
    return this.copy(topic);
  }

  public async setTopicStatus(topicId: string, status: HelpTopicStatus, editorName: string, mergedIntoTopicId?: string | null) {
    const topic = this.topics.get(topicId);
    if (topic === undefined) return null;
    Object.assign(topic, { status, updatedByName: editorName }, mergedIntoTopicId === undefined ? {} : { mergedIntoTopicId });
    return this.copy(topic);
  }

  public async deleteTopic(topicId: string) {
    return this.topics.delete(topicId);
  }

  public async listTopicVersions(topicId: string) {
    return this.versions.get(topicId) ?? [];
  }

  public async listAdminTopics(filter: Parameters<HelpContentStore["listAdminTopics"]>[0]) {
    const items = [...this.topics.values()].filter((topic) => (filter.status === undefined || topic.status === filter.status) && (filter.origin === undefined || topic.origin === filter.origin));
    return { items: items.map((topic) => this.copy(topic)), total: items.length };
  }

  public async recordVote(topicId: string, voterKey: string, helpful: boolean) {
    const topic = this.topics.get(topicId);
    if (topic === undefined) return null;
    const key = `${topicId}:${voterKey}`;
    const previous = this.votes.get(key);
    if (previous !== helpful) {
      if (previous === true) topic.helpfulCount -= 1;
      if (previous === false) topic.notHelpfulCount -= 1;
      if (helpful) topic.helpfulCount += 1;
      else topic.notHelpfulCount += 1;
      this.votes.set(key, helpful);
    }
    return this.copy(topic);
  }

  public async findVote(topicId: string, voterKey: string) {
    return this.votes.get(`${topicId}:${voterKey}`) ?? null;
  }

  public async createAutoTopicLog(entry: NewAutoTopicLog) {
    const log = { id: randomUUID(), ...entry, createdAt: new Date() };
    this.logs.push(log);
    return log;
  }

  public async listAutoTopicLogs(page: number, pageSize: number) {
    return { items: this.logs.slice((page - 1) * pageSize, page * pageSize), total: this.logs.length };
  }

  public async readSetting<T>(key: string, fallback: T): Promise<T> {
    return (this.settings.has(key) ? this.settings.get(key) : fallback) as T;
  }

  public async writeSetting(key: string, value: unknown) {
    this.settings.set(key, value);
  }
}
