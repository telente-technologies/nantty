import { listMockAuditEntriesForTarget, recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { createMockId, failConflict, failNotFound, failValidation, matchesSearchText, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { ContentTopic } from "@/types/catalog.type";

import { convertTextToSlug, readCatalogMockStore } from "./contentStores.mock";

function findTopicOrFail(topicId: string | undefined): ContentTopic {
  const topic = readCatalogMockStore().topics.find((candidate) => candidate.id === topicId);
  if (!topic) failNotFound("Topic");
  return topic;
}

function ensureTopicSlugIsFree(slug: string, excludedTopicId: string | null): void {
  if (readCatalogMockStore().topics.some((topic) => topic.slug === slug && topic.id !== excludedTopicId)) failConflict("SLUG_TAKEN", "Another topic already uses this name.");
}

export function registerCatalogTopicMockHandlers(): void {
  registerMockRoute("GET", "/admin/catalog/topics", (request) => {
    requireMockPermission(request, "catalog:manage");
    const search = request.query.get("search");
    const status = request.query.get("status");
    const topics = readCatalogMockStore().topics.filter((topic) => matchesSearchText(search, topic.name, topic.slug) && (!status || topic.status === status));
    return respondWithJson(200, { items: [...topics].sort((first, second) => second.postCount - first.postCount) });
  });

  registerMockRoute("GET", "/admin/catalog/topics/:topicId", (request) => {
    requireMockPermission(request, "catalog:manage");
    const topic = findTopicOrFail(request.params.topicId);
    return respondWithJson(200, { item: topic, history: listMockAuditEntriesForTarget("topic", topic.id) });
  });

  registerMockRoute("POST", "/admin/catalog/topics", (request) => {
    requireMockPermission(request, "catalog:manage");
    const body = readJsonObjectBody(request);
    const name = readRequiredTrimmedString(body, "name", 40, 2);
    const slug = convertTextToSlug(name);
    if (!slug) failValidation("name", "Use letters or numbers in the topic name.");
    ensureTopicSlugIsFree(slug, null);
    const reason = readRequiredReason(body);
    const topic: ContentTopic = { id: createMockId("top"), name, slug, status: "ACTIVE", isTrending: false, postCount: 0, followerCount: 0, updatedAt: readIsoNow() };
    readCatalogMockStore().topics.push(topic);
    recordMockAuditEntry(request, { action: "catalog.topic_created", area: "catalog", target: { type: "topic", id: topic.id, label: topic.name }, reason, before: null, after: topic });
    return respondWithJson(201, { item: topic });
  });

  registerMockRoute("PATCH", "/admin/catalog/topics/:topicId", (request) => {
    requireMockPermission(request, "catalog:manage");
    const before = findTopicOrFail(request.params.topicId);
    const body = readJsonObjectBody(request);
    const name = body.name === undefined ? before.name : readRequiredTrimmedString(body, "name", 40, 2);
    const slug = name === before.name ? before.slug : convertTextToSlug(name);
    ensureTopicSlugIsFree(slug, before.id);
    const status = body.status === undefined ? before.status : readEnumValue(body, "status", ["ACTIVE", "HIDDEN"] as const);
    if (body.isTrending !== undefined && typeof body.isTrending !== "boolean") failValidation("isTrending", "isTrending must be true or false.");
    if (status === "HIDDEN" && body.isTrending === true) failConflict("TOPIC_HIDDEN", "Show the topic again before marking it trending.");
    const isTrending = status === "HIDDEN" ? false : body.isTrending === undefined ? before.isTrending : (body.isTrending as boolean);
    const reason = readRequiredReason(body);
    const updated: ContentTopic = { ...before, name, slug, status, isTrending, updatedAt: readIsoNow() };
    const store = readCatalogMockStore();
    store.topics = store.topics.map((topic) => (topic.id === updated.id ? updated : topic));
    recordMockAuditEntry(request, { action: "catalog.topic_updated", area: "catalog", target: { type: "topic", id: updated.id, label: updated.name }, reason, before: { name: before.name, status: before.status, isTrending: before.isTrending }, after: { name, status, isTrending } });
    return respondWithJson(200, { item: updated });
  });
}
