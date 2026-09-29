import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";

import { countPendingApplications, registerPeopleApplicationMockHandlers } from "./peopleApplications.mock";
import { registerPeopleUsernameMockHandlers } from "./peopleUsernames.mock";
import { registerPeopleUserMockHandlers } from "./peopleUsers.mock";
import { countPendingVerifications, registerPeopleVerificationMockHandlers } from "./peopleVerifications.mock";

export function registerPeopleMockHandlers(): void {
  registerPeopleUserMockHandlers();
  registerPeopleUsernameMockHandlers();
  registerPeopleVerificationMockHandlers();
  registerPeopleApplicationMockHandlers();
  registerMockQueueCounter({ key: "verification", label: "Verification reviews", href: "/verification", readCount: countPendingVerifications });
  registerMockQueueCounter({ key: "sellerApplications", label: "Seller applications", href: "/applications/sellers", readCount: () => countPendingApplications("sellers") });
  registerMockQueueCounter({ key: "creatorApplications", label: "Creator applications", href: "/applications/creators", readCount: () => countPendingApplications("creators") });
}
