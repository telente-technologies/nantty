import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";

import { registerCatalogCategoryMockHandlers } from "./catalogCategories.mock";
import { registerCatalogFeatureMockHandlers } from "./catalogFeatures.mock";
import { registerCatalogTopicMockHandlers } from "./catalogTopics.mock";
import { readSupportMockStore } from "./contentStores.mock";
import { registerSupportMacroMockHandlers } from "./supportMacros.mock";
import { isSupportTicketBreachingSla } from "./supportTicketPresenter.mock";
import { registerSupportTicketMockHandlers } from "./supportTickets.mock";

function countOpenSupportTickets() {
  const openTickets = readSupportMockStore().tickets.filter((ticket) => ticket.status === "OPEN" || ticket.status === "PENDING");
  const oldestAt = openTickets.map((ticket) => ticket.createdAt).sort()[0] ?? null;
  return { count: openTickets.length, oldestAt, breachingSla: openTickets.filter((ticket) => isSupportTicketBreachingSla(ticket)).length };
}

export function registerContentAndSupportMockHandlers(): void {
  registerCatalogCategoryMockHandlers();
  registerCatalogTopicMockHandlers();
  registerCatalogFeatureMockHandlers();
  registerSupportTicketMockHandlers();
  registerSupportMacroMockHandlers();
  registerMockQueueCounter({ key: "supportTickets", label: "Support tickets", href: "/support", readCount: countOpenSupportTickets });
}
