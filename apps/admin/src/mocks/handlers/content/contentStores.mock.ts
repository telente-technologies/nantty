import { readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { buildDemoCatalogCategories, buildDemoContentTopics, buildDemoMartHomeFeatures, buildMartHomeImageLibrary, type MockMartHomeFeatureRecord } from "@/mocks/seed/catalogSeed.mock";
import { buildDemoSupportMacros, buildDemoSupportTickets, type MockSupportMacroRecord, type MockSupportTicketRecord } from "@/mocks/seed/supportSeed.mock";
import type { CatalogCategory, ContentTopic, MartHomeImageOption } from "@/types/catalog.type";

export interface CatalogMockStore {
  categories: CatalogCategory[];
  topics: ContentTopic[];
  features: MockMartHomeFeatureRecord[];
  readonly imageLibrary: readonly MartHomeImageOption[];
}

export interface SupportMockStore {
  tickets: MockSupportTicketRecord[];
  macros: MockSupportMacroRecord[];
}

export function readCatalogMockStore(): CatalogMockStore {
  return readMockAreaStore("catalog", () => ({ categories: buildDemoCatalogCategories(), topics: buildDemoContentTopics(), features: buildDemoMartHomeFeatures(), imageLibrary: buildMartHomeImageLibrary() }));
}

export function readSupportMockStore(): SupportMockStore {
  return readMockAreaStore("support", () => ({ tickets: buildDemoSupportTickets(), macros: buildDemoSupportMacros() }));
}

export function convertTextToSlug(text: string): string {
  return text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
