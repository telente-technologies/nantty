import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { CatalogCategory, CatalogEntityWithHistory, ContentTopic, ContentTopicStatus, MartHomeFeature, MartHomeFeatureKind, MartHomeFeatureTargetType, MartHomeImageOption } from "@/types/catalog.type";

const encode = encodeURIComponent;

export function fetchCatalogCategories(signal?: AbortSignal): Promise<{ items: CatalogCategory[] }> {
  return sendAdminApiRequest("/admin/catalog/categories", { signal });
}

export function fetchCatalogCategoryWithHistory(categoryId: string, signal?: AbortSignal): Promise<CatalogEntityWithHistory<CatalogCategory>> {
  return sendAdminApiRequest(`/admin/catalog/categories/${encode(categoryId)}`, { signal });
}

export interface CategoryEditorInput {
  readonly name: string;
  readonly slug?: string;
  readonly parentId: string | null;
  readonly iconName: string | null;
  readonly reason: string;
}

export function createCatalogCategory(input: CategoryEditorInput): Promise<{ item: CatalogCategory }> {
  return sendAdminApiRequest("/admin/catalog/categories", { method: "POST", body: input });
}

export function updateCatalogCategory(categoryId: string, input: CategoryEditorInput): Promise<{ item: CatalogCategory }> {
  return sendAdminApiRequest(`/admin/catalog/categories/${encode(categoryId)}`, { method: "PATCH", body: input });
}

export function moveCatalogCategory(categoryId: string, direction: "up" | "down"): Promise<{ items: CatalogCategory[] }> {
  return sendAdminApiRequest(`/admin/catalog/categories/${encode(categoryId)}/move`, { method: "POST", body: { direction } });
}

export function setCatalogCategoryActive(categoryId: string, isActive: boolean, reason: string): Promise<{ item: CatalogCategory }> {
  return sendAdminApiRequest(`/admin/catalog/categories/${encode(categoryId)}/${isActive ? "activate" : "deactivate"}`, { method: "POST", body: { reason } });
}

export function fetchContentTopics(filters: { search?: string; status?: string }, signal?: AbortSignal): Promise<{ items: ContentTopic[] }> {
  return sendAdminApiRequest("/admin/catalog/topics", { query: { ...filters }, signal });
}

export function fetchContentTopicWithHistory(topicId: string, signal?: AbortSignal): Promise<CatalogEntityWithHistory<ContentTopic>> {
  return sendAdminApiRequest(`/admin/catalog/topics/${encode(topicId)}`, { signal });
}

export function createContentTopic(name: string, reason: string): Promise<{ item: ContentTopic }> {
  return sendAdminApiRequest("/admin/catalog/topics", { method: "POST", body: { name, reason } });
}

export function updateContentTopic(topicId: string, changes: { name?: string; status?: ContentTopicStatus; isTrending?: boolean; reason: string }): Promise<{ item: ContentTopic }> {
  return sendAdminApiRequest(`/admin/catalog/topics/${encode(topicId)}`, { method: "PATCH", body: changes });
}

export function fetchMartHomeFeatures(signal?: AbortSignal): Promise<{ items: MartHomeFeature[] }> {
  return sendAdminApiRequest("/admin/catalog/features", { signal });
}

export function fetchMartHomeImageLibrary(signal?: AbortSignal): Promise<{ items: MartHomeImageOption[]; countries: string[] }> {
  return sendAdminApiRequest("/admin/catalog/features/image-library", { signal });
}

export function fetchMartHomeFeatureWithHistory(featureId: string, signal?: AbortSignal): Promise<CatalogEntityWithHistory<MartHomeFeature>> {
  return sendAdminApiRequest(`/admin/catalog/features/${encode(featureId)}`, { signal });
}

export interface MartHomeFeatureInput {
  readonly title: string;
  readonly subtitle: string | null;
  readonly kind: MartHomeFeatureKind;
  readonly imageId: string;
  readonly targetType: MartHomeFeatureTargetType;
  readonly targetValue: string;
  readonly countries: readonly string[];
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly reason: string;
}

export function createMartHomeFeature(input: MartHomeFeatureInput): Promise<{ item: MartHomeFeature }> {
  return sendAdminApiRequest("/admin/catalog/features", { method: "POST", body: input });
}

export function updateMartHomeFeature(featureId: string, input: MartHomeFeatureInput): Promise<{ item: MartHomeFeature }> {
  return sendAdminApiRequest(`/admin/catalog/features/${encode(featureId)}`, { method: "PATCH", body: input });
}

export function setMartHomeFeaturePublished(featureId: string, isPublished: boolean, reason: string): Promise<{ item: MartHomeFeature }> {
  return sendAdminApiRequest(`/admin/catalog/features/${encode(featureId)}/${isPublished ? "publish" : "unpublish"}`, { method: "POST", body: { reason } });
}

export function moveMartHomeFeature(featureId: string, direction: "up" | "down"): Promise<{ items: MartHomeFeature[] }> {
  return sendAdminApiRequest(`/admin/catalog/features/${encode(featureId)}/move`, { method: "POST", body: { direction } });
}
