import { cache } from "react";

import type { HelpCategory, HelpTopicDetail, HelpTopicSummary } from "@/types/helpCentre.type";

import { callWebappBackend, readJsonFromBackendResult } from "./apiTransport.service";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function fetchHelpJson<Payload>(path: string, query?: Record<string, string>): Promise<Payload | null> {
  const result = await callWebappBackend({ method: "GET", path, query: new URLSearchParams(query ?? {}), forwardedHeaders: {} });
  if (result.status !== 200) return null;
  return readJsonFromBackendResult<Payload>(result);
}

export const fetchHelpCategories = cache(async (): Promise<readonly HelpCategory[]> => (await fetchHelpJson<{ items: HelpCategory[] }>("/api/v1/help/categories"))?.items ?? []);

export const fetchHelpCategory = cache(async (categorySlug: string): Promise<{ readonly category: HelpCategory; readonly topics: readonly HelpTopicSummary[] } | null> =>
  slugPattern.test(categorySlug) ? fetchHelpJson(`/api/v1/help/categories/${categorySlug}`) : null);

export const fetchHelpTopic = cache(async (topicSlug: string): Promise<HelpTopicDetail | null> =>
  slugPattern.test(topicSlug) ? fetchHelpJson<HelpTopicDetail>(`/api/v1/help/topics/${topicSlug}`) : null);

export const searchHelpTopics = cache(async (query: string): Promise<readonly HelpTopicSummary[]> =>
  query.trim() === "" ? [] : (await fetchHelpJson<{ items: HelpTopicSummary[] }>("/api/v1/help/topics", { q: query.trim().slice(0, 120) }))?.items ?? []);
