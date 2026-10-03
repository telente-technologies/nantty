import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";

import { registerLegalDocumentMockHandlers } from "./legalDocuments.mock";
import { registerLegalNoticeDraftMockHandlers } from "./legalNoticeDrafts.mock";
import { registerLegalNoticeMockHandlers } from "./legalNotices.mock";
import { readLegalStore } from "./legalStore.mock";

export function registerLegalMockHandlers(): void {
  registerLegalDocumentMockHandlers();
  registerLegalNoticeMockHandlers();
  registerLegalNoticeDraftMockHandlers();
  registerMockQueueCounter({ key: "legalReview", label: "Legal versions in review", href: "/legal", readCount: () => {
    const inReview = readLegalStore().versions.filter((version) => version.status === "IN_REVIEW");
    return { count: inReview.length, oldestAt: inReview.map((version) => version.submittedAt ?? "").sort()[0] ?? null };
  } });
}
