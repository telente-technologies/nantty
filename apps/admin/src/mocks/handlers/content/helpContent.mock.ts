import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failNotFound, failValidation, matchesSearchText, paginateItems, readIsoNow, readJsonObjectBody, readRequiredTrimmedString, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { buildDemoHelpStore, type MockHelpStore } from "@/mocks/seed/helpContentSeed.mock";
import type { HelpTopic } from "@/types/helpContent.type";

const readPermission = ["support:helpContent", "support:tickets", "support:assign"] as const;
const store = (): MockHelpStore => readMockAreaStore("support:helpContent", buildDemoHelpStore);
const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "topic";

function findTopic(topicId: string | undefined): HelpTopic {
  const topic = store().topics.find((candidate) => candidate.id === topicId);
  if (!topic) failNotFound("Help topic");
  return topic;
}

function detail(topic: HelpTopic) {
  return { topic, versions: [...(store().versions[topic.id] ?? [])].reverse(), relatedTopicIds: store().related[topic.id] ?? [] };
}

function saveTopic(request: MockRequest, existing: HelpTopic | null): HelpTopic {
  const principal = requireMockPermission(request, "support:helpContent");
  const body = readJsonObjectBody(request);
  const title = readRequiredTrimmedString(body, "title", 140, 5);
  const bodyMarkdown = readRequiredTrimmedString(body, "bodyMarkdown", 40_000, 20);
  if (/<\s*script|javascript:/i.test(bodyMarkdown)) throw new MockHttpError(400, "UNSAFE_MARKDOWN", "Markdown cannot contain scripts, embedded frames or inline event handlers.");
  const category = store().categories.find((candidate) => candidate.id === body.categoryId);
  if (!category) failValidation("categoryId", "Choose an existing category.");
  const slug = typeof body.slug === "string" && body.slug ? body.slug : existing?.slug ?? slugify(title);
  if (store().topics.some((candidate) => candidate.slug === slug && candidate.id !== existing?.id)) throw new MockHttpError(409, "SLUG_TAKEN", "Another topic already uses this address.");
  const now = readIsoNow();
  const fields = { title, slug, bodyMarkdown, summary: typeof body.summary === "string" && body.summary ? body.summary : title, tags: Array.isArray(body.tags) ? (body.tags as string[]) : [], categoryId: category.id, categorySlug: category.slug, categoryTitle: category.title, updatedByName: principal.name, updatedAt: now };
  const publish = body.status === "PUBLISHED";
  const topic: HelpTopic = existing
    ? Object.assign(existing, fields, { version: existing.version + 1, editedByStaff: true }, publish ? { status: "PUBLISHED" as const, publishedAt: now } : {})
    : { id: createMockId("htop"), ...fields, status: publish ? "PUBLISHED" : "DRAFT", origin: "EDITORIAL", fromResolvedQuestion: false, sourceTicketId: null, mergedIntoTopicId: null, editedByStaff: true, version: 1, helpfulCount: 0, notHelpfulCount: 0, relatedQuestions: 0, publishedAt: publish ? now : null, createdAt: now };
  if (!existing) store().topics.unshift(topic);
  store().versions[topic.id] = [...(store().versions[topic.id] ?? []), { version: topic.version, title, summary: topic.summary, bodyMarkdown, tags: topic.tags, editedByName: principal.name, changeNote: typeof body.changeNote === "string" && body.changeNote ? body.changeNote : existing ? "Edited" : "Created", createdAt: now }];
  if (Array.isArray(body.relatedTopicIds)) store().related[topic.id] = (body.relatedTopicIds as string[]).slice(0, 8);
  recordMockAuditEntry(request, { action: existing ? "help.topic_updated" : "help.topic_created", area: "support", target: { type: "helpTopic", id: topic.id, label: title.slice(0, 60) }, after: { version: topic.version, status: topic.status } });
  return topic;
}

export function registerHelpContentMockHandlers(): void {
  registerMockRoute("GET", "/admin/help/categories", (request) => {
    requireMockPermission(request, ...readPermission);
    return respondWithJson(200, { items: store().categories.map((category) => ({ ...category, topicCount: store().topics.filter((topic) => topic.categoryId === category.id && topic.status === "PUBLISHED").length })) });
  });
  registerMockRoute("POST", "/admin/help/categories", (request) => {
    requireMockPermission(request, "support:helpContent");
    const body = readJsonObjectBody(request);
    const category = { id: createMockId("hcat"), slug: readRequiredTrimmedString(body, "slug", 60, 2), title: readRequiredTrimmedString(body, "title", 80, 2), description: String(body.description ?? ""), iconName: String(body.iconName ?? "question"), position: Number(body.position ?? 0) };
    store().categories.push(category);
    return respondWithJson(201, { ...category, topicCount: 0 });
  });
  registerMockRoute("PUT", "/admin/help/categories/:categoryId", (request) => {
    requireMockPermission(request, "support:helpContent");
    const category = store().categories.find((candidate) => candidate.id === request.params.categoryId);
    if (!category) failNotFound("Help category");
    const body = readJsonObjectBody(request);
    Object.assign(category, { slug: readRequiredTrimmedString(body, "slug", 60, 2), title: readRequiredTrimmedString(body, "title", 80, 2), description: String(body.description ?? ""), iconName: String(body.iconName ?? "question"), position: Number(body.position ?? 0) });
    return respondWithJson(200, { ...category, topicCount: 0 });
  });
  registerMockRoute("DELETE", "/admin/help/categories/:categoryId", (request) => {
    requireMockPermission(request, "support:helpContent");
    if (store().topics.some((topic) => topic.categoryId === request.params.categoryId)) throw new MockHttpError(409, "CATEGORY_NOT_EMPTY", "Move or delete the topics in this category first.");
    store().categories = store().categories.filter((category) => category.id !== request.params.categoryId);
    return respondWithNoContent();
  });
  registerMockRoute("GET", "/admin/help/topics", (request) => {
    requireMockPermission(request, ...readPermission);
    const [status, origin, categoryId, search] = ["status", "origin", "categoryId", "search"].map((key) => request.query.get(key));
    const items = store().topics.filter((topic) => (!status || topic.status === status) && (!origin || topic.origin === origin) && (!categoryId || topic.categoryId === categoryId) && matchesSearchText(search ?? null, topic.title, topic.slug, topic.bodyMarkdown));
    return respondWithJson(200, paginateItems(items, request));
  });
  registerMockRoute("POST", "/admin/help/topics", (request) => respondWithJson(201, saveTopic(request, null)));
  registerMockRoute("GET", "/admin/help/topics/:topicId", (request) => {
    requireMockPermission(request, ...readPermission);
    return respondWithJson(200, detail(findTopic(request.params.topicId)));
  });
  registerMockRoute("PUT", "/admin/help/topics/:topicId", (request) => respondWithJson(200, saveTopic(request, findTopic(request.params.topicId))));
  registerMockRoute("DELETE", "/admin/help/topics/:topicId", (request) => {
    requireMockPermission(request, "support:helpContent");
    findTopic(request.params.topicId);
    store().topics = store().topics.filter((topic) => topic.id !== request.params.topicId);
    return respondWithNoContent();
  });
  for (const [action, status] of [["publish", "PUBLISHED"], ["unpublish", "UNPUBLISHED"]] as const) {
    registerMockRoute("POST", `/admin/help/topics/:topicId/${action}`, (request) => {
      const principal = requireMockPermission(request, "support:helpContent");
      const topic = findTopic(request.params.topicId);
      if (topic.status === status) throw new MockHttpError(409, "NO_CHANGE", `This topic is already ${status.toLowerCase()}.`);
      Object.assign(topic, { status, updatedByName: principal.name, updatedAt: readIsoNow() }, status === "PUBLISHED" ? { publishedAt: readIsoNow() } : {});
      return respondWithJson(200, topic);
    });
  }
  registerMockRoute("POST", "/admin/help/topics/:topicId/merge", (request) => {
    const principal = requireMockPermission(request, "support:helpContent");
    const source = findTopic(request.params.topicId);
    const target = findTopic(String(readJsonObjectBody(request).targetTopicId ?? ""));
    if (source.id === target.id) failValidation("targetTopicId", "Choose a different topic to merge into.");
    Object.assign(target, { bodyMarkdown: `${target.bodyMarkdown}\n\n## Related question: ${source.title}\n\n${source.bodyMarkdown}`, version: target.version + 1, relatedQuestions: target.relatedQuestions + 1, updatedByName: principal.name, updatedAt: readIsoNow() });
    Object.assign(source, { status: "MERGED", mergedIntoTopicId: target.id });
    return respondWithJson(200, target);
  });
  registerMockRoute("GET", "/admin/help/auto-topics", (request) => {
    requireMockPermission(request, ...readPermission);
    const items = store().autoLog.map(({ topicId, ...entry }) => ({ ...entry, topic: store().topics.find((topic) => topic.id === topicId) ?? null }));
    return respondWithJson(200, paginateItems(items, request));
  });
  registerMockRoute("GET", "/admin/help/settings", (request) => {
    requireMockPermission(request, ...readPermission);
    return respondWithJson(200, { autoFaqRequiresReview: store().autoFaqRequiresReview });
  });
  registerMockRoute("PUT", "/admin/help/settings", (request) => {
    requireMockPermission(request, "support:helpContent");
    store().autoFaqRequiresReview = readJsonObjectBody(request).autoFaqRequiresReview === true;
    return respondWithJson(200, { autoFaqRequiresReview: store().autoFaqRequiresReview });
  });
}
