import { registerBrandDirectoryMockHandlers } from "@/mocks/handlers/brands/brandsDirectory.mock";
import { registerIpClaimMockHandlers } from "@/mocks/handlers/brands/brandsIpClaims.mock";
import { readBrandsMockStore } from "@/mocks/handlers/brands/brandsStore.mock";
import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";

const officialReviewSlaInMilliseconds = 72 * 3_600_000;

function readOldestTimestamp(timestamps: readonly string[]): string | null {
  return [...timestamps].sort()[0] ?? null;
}

export function registerBrandsMockHandlers(): void {
  registerBrandDirectoryMockHandlers();
  registerIpClaimMockHandlers();
  registerMockQueueCounter({
    key: "brandVerification",
    label: "Official Store requests",
    href: "/brands?official=PENDING",
    readCount: () => {
      const submittedTimes = readBrandsMockStore().brands.filter((brand) => brand.officialStatus === "PENDING").map((brand) => brand.officialRequest?.submittedAt ?? brand.createdAt);
      return { count: submittedTimes.length, oldestAt: readOldestTimestamp(submittedTimes), breachingSla: submittedTimes.filter((time) => Date.now() - new Date(time).getTime() > officialReviewSlaInMilliseconds).length };
    },
  });
  registerMockQueueCounter({
    key: "ipClaims",
    label: "Trademark claims",
    href: "/ip-claims",
    readCount: () => {
      const openClaims = readBrandsMockStore().claims.filter((claim) => claim.status === "OPEN");
      return { count: openClaims.length, oldestAt: readOldestTimestamp(openClaims.map((claim) => claim.filedAt)), breachingSla: openClaims.filter((claim) => new Date(claim.slaDueAt).getTime() < Date.now()).length };
    },
  });
}
