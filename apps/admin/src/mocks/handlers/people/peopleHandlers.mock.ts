import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";

import { countPendingApplications, registerPeopleApplicationMockHandlers } from "./peopleApplications.mock";
import { registerPeopleAccountsAdminMockHandlers } from "./peopleAccountsAdmin.mock";
import { registerPeopleBlackApplicationMockHandlers } from "./peopleBlackApplications.mock";
import { registerPeopleBusinessDocumentMockHandlers } from "./peopleBusinessDocuments.mock";
import { countIdentityCasesNeedingReview, registerPeopleIdentityCheckMockHandlers } from "./peopleIdentityChecks.mock";
import { registerPeopleUserActionMockHandlers } from "./peopleUserActions.mock";
import { registerPeopleUsernameMockHandlers } from "./peopleUsernames.mock";
import { registerPeopleUserMockHandlers } from "./peopleUsers.mock";
import { countPendingVerifications, registerPeopleVerificationMockHandlers } from "./peopleVerifications.mock";

export function registerPeopleMockHandlers(): void {
  registerPeopleUserMockHandlers();
  registerPeopleUsernameMockHandlers();
  registerPeopleAccountsAdminMockHandlers();
  registerPeopleUserActionMockHandlers();
  registerPeopleBusinessDocumentMockHandlers();
  registerPeopleBlackApplicationMockHandlers();
  registerPeopleVerificationMockHandlers();
  registerPeopleIdentityCheckMockHandlers();
  registerPeopleApplicationMockHandlers();
  registerMockQueueCounter({ key: "verification", label: "Verification reviews", href: "/verification", readCount: countPendingVerifications });
  registerMockQueueCounter({ key: "identityChecks", label: "Identity checks", href: "/verification/identity", readCount: countIdentityCasesNeedingReview });
  registerMockQueueCounter({ key: "sellerApplications", label: "Seller applications", href: "/applications/sellers", readCount: () => countPendingApplications("sellers") });
  registerMockQueueCounter({ key: "creatorApplications", label: "Creator applications", href: "/applications/creators", readCount: () => countPendingApplications("creators") });
}
