import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { PagedList } from "@/types/api.type";
import type { AutoTopicLogEntry, HelpCategory, HelpCategoryInput, HelpSettings, HelpTopic, HelpTopicDetail, HelpTopicInput } from "@/types/helpContent.type";

const encode = encodeURIComponent;

export interface HelpTopicFilters {
  readonly status?: string;
  readonly origin?: string;
  readonly categoryId?: string;
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export const fetchHelpCategories = (signal?: AbortSignal): Promise<{ items: HelpCategory[] }> => sendAdminApiRequest("/admin/help/categories", { signal });
export const createHelpCategory = (input: HelpCategoryInput): Promise<HelpCategory> => sendAdminApiRequest("/admin/help/categories", { method: "POST", body: input });
export const updateHelpCategory = (categoryId: string, input: HelpCategoryInput): Promise<HelpCategory> => sendAdminApiRequest(`/admin/help/categories/${encode(categoryId)}`, { method: "PUT", body: input });
export const deleteHelpCategory = (categoryId: string): Promise<void> => sendAdminApiRequest(`/admin/help/categories/${encode(categoryId)}`, { method: "DELETE" });

export const fetchHelpTopics = (filters: HelpTopicFilters, signal?: AbortSignal): Promise<PagedList<HelpTopic>> => sendAdminApiRequest("/admin/help/topics", { query: { ...filters }, signal });
export const fetchHelpTopic = (topicId: string, signal?: AbortSignal): Promise<HelpTopicDetail> => sendAdminApiRequest(`/admin/help/topics/${encode(topicId)}`, { signal });
export const createHelpTopic = (input: HelpTopicInput): Promise<HelpTopic> => sendAdminApiRequest("/admin/help/topics", { method: "POST", body: input });
export const updateHelpTopic = (topicId: string, input: HelpTopicInput): Promise<HelpTopic> => sendAdminApiRequest(`/admin/help/topics/${encode(topicId)}`, { method: "PUT", body: input });
export const deleteHelpTopic = (topicId: string): Promise<void> => sendAdminApiRequest(`/admin/help/topics/${encode(topicId)}`, { method: "DELETE" });
export const publishHelpTopic = (topicId: string): Promise<HelpTopic> => sendAdminApiRequest(`/admin/help/topics/${encode(topicId)}/publish`, { method: "POST" });
export const unpublishHelpTopic = (topicId: string): Promise<HelpTopic> => sendAdminApiRequest(`/admin/help/topics/${encode(topicId)}/unpublish`, { method: "POST" });
export const mergeHelpTopic = (topicId: string, targetTopicId: string): Promise<HelpTopic> => sendAdminApiRequest(`/admin/help/topics/${encode(topicId)}/merge`, { method: "POST", body: { targetTopicId } });

export const fetchAutoTopicLog = (page: number, signal?: AbortSignal): Promise<PagedList<AutoTopicLogEntry>> => sendAdminApiRequest("/admin/help/auto-topics", { query: { page }, signal });
export const fetchHelpSettings = (signal?: AbortSignal): Promise<HelpSettings> => sendAdminApiRequest("/admin/help/settings", { signal });
export const updateHelpSettings = (settings: HelpSettings): Promise<HelpSettings> => sendAdminApiRequest("/admin/help/settings", { method: "PUT", body: settings });
