import { ApiError } from "@/errors/api.error";

import { accountHealthMocks } from "./accountHealth.mock";
import { accountStatusMocks } from "./accountStatus.mock";
import { celebrationsMocks } from "./celebrations.mock";
import { identityVerificationMocks } from "./identityVerification.mock";
import { notificationPreferencesMocks } from "./notificationPreferences.mock";
import { businessDocumentsMocks } from "./businessDocuments.mock";
import { checkmarkSuggestionMocks } from "./checkmarkSuggestions.mock";
import { helpCenterMocks } from "./helpCenter.mock";
import { exploreMocks } from "./explore.mock";
import { mentionsMocks } from "./mentions.mock";
import { marketingPreferencesMocks } from "./marketingPreferences.mock";
import { adEventsMocks } from "./adEvents.mock";
import { authMocks } from "./auth.mock";
import { banksMocks } from "./banks.mock";
import { boostsMocks } from "./boosts.mock";
import { businessProfilesMocks } from "./businessProfiles.mock";
import { brandsMocks } from "./brands.mock";
import { cartMocks } from "./cart.mock";
import { chatContentMocks } from "./chatContent.mock";
import { chatInboxMocks } from "./chatInbox.mock";
import { chatAttachmentMocks } from "./chatAttachmentRoutes.mock";
import { chatKeysMocks } from "./chatKeys.mock";
import { chatsMocks } from "./chats.mock";
import { groupsMocks } from "./groups.mock";
import { clipsMocks } from "./clips.mock";
import { coinsMocks } from "./coins.mock";
import { commentsMocks } from "./comments.mock";
import { postThreadMocks } from "./postThread.mock";
import { soundsMocks } from "./sounds.mock";
import { creatorProgramMocks } from "./creatorProgram.mock";
import { creatorsMocks } from "./creators.mock";
import { creatorSubscriptionsMocks } from "./creatorSubscriptions.mock";
import { disputesMocks } from "./disputes.mock";
import { followGraphMocks } from "./followGraph.mock";
import { feedMocks } from "./feed.mock";
import { giftsMocks } from "./gifts.mock";
import { liveMocks } from "./live.mock";
import { liveBattleMocks } from "./liveBattle.mock";
import { liveGuestsMocks } from "./liveGuests.mock";
import { localeMocks } from "./locale.mock";
import { mediaMocks } from "./media.mock";
import { notificationsMocks } from "./notifications.mock";
import { ordersMocks } from "./orders.mock";
import { postsMocks } from "./posts.mock";
import { mediaDownloadsMocks } from "./mediaDownloads.mock";
import { taggedUsersMocks } from "./taggedUsers.mock";
import { postAudienceMocks } from "./postAudience.mock";
import { placesMocks } from "./places.mock";
import { postTagsMocks } from "./postTags.mock";
import { productsMocks } from "./products.mock";
import { searchMocks } from "./search.mock";
import { martHighlightsMocks } from "./martHighlights.mock";
import { storeRewardsMocks } from "./storeRewards.mock";
import { savesMocks } from "./saves.mock";
import { guestAccessMocks } from "./guestAccess.mock";
import { matchMockPathAndExtractParams, type MockRoute } from "./registry.mock";
import { sellerMocks } from "./seller.mock";
import { geoMocks } from "./geo.mock";
import { legalMocks } from "./legal.mock";
import { privacyMocks } from "./privacy.mock";
import { settingsMocks } from "./settings.mock";
import { storiesMocks } from "./stories.mock";
import { supportMocks } from "./support.mock";
import { usernameMocks } from "./username.mock";
import { usersMocks } from "./users.mock";
import { verificationMocks } from "./verification.mock";
import { zudoPointsMocks } from "./zudoPoints.mock";
import { walletMocks } from "./wallet.mock";
import { payoutOnboardingMocks } from "./payoutOnboarding.mock";
import { chatReportsMocks } from "./chatReports.mock";
import { reportsMocks } from "./reports.mock";
import { liveSafetyMocks } from "./liveSafety.mock";

const routes: MockRoute[] = [
  ...localeMocks,
  ...usernameMocks,
  ...accountStatusMocks,
  ...accountHealthMocks,
  ...celebrationsMocks,
  ...notificationPreferencesMocks,
  ...businessDocumentsMocks,
  ...checkmarkSuggestionMocks,
  ...helpCenterMocks,
  ...marketingPreferencesMocks,
  ...mentionsMocks,
  ...authMocks,
  ...followGraphMocks,
  ...usersMocks,
  ...feedMocks,
  ...exploreMocks,
  ...postAudienceMocks,
  ...placesMocks,
  ...postTagsMocks,
  ...taggedUsersMocks,
  ...mediaDownloadsMocks,
  ...postsMocks,
  ...productsMocks,
  ...searchMocks,
  ...martHighlightsMocks,
  ...storeRewardsMocks,
  ...savesMocks,
  ...cartMocks,
  ...ordersMocks,
  ...disputesMocks,
  ...banksMocks,
  ...creatorSubscriptionsMocks,
  ...creatorProgramMocks,
  ...identityVerificationMocks,
  ...verificationMocks,
  ...boostsMocks,
  ...brandsMocks,
  ...businessProfilesMocks,
  ...supportMocks,
  ...groupsMocks,
  ...chatKeysMocks,
  ...chatsMocks,
  ...chatAttachmentMocks,
  ...chatInboxMocks,
  ...chatContentMocks,
  ...clipsMocks,
  ...commentsMocks,
  ...postThreadMocks,
  ...soundsMocks,
  ...mediaMocks,
  ...adEventsMocks,
  ...reportsMocks,
  ...liveSafetyMocks,
  ...chatReportsMocks,
  ...coinsMocks,
  ...notificationsMocks,
  ...liveMocks.filter((route) => route.path === "/api/v1/lives/suggested"),
  ...creatorsMocks,
  ...giftsMocks,
  ...zudoPointsMocks,
  ...liveMocks,
  ...liveGuestsMocks,
  ...liveBattleMocks,
  ...storiesMocks,
  ...settingsMocks,
  ...geoMocks,
  ...privacyMocks,
  ...legalMocks,
  ...walletMocks,
  ...payoutOnboardingMocks,
  ...sellerMocks,
];

export async function resolveMockApiRequest<T>(method: string, url: string, body: unknown, idempotencyKey?: string, isGuest = false): Promise<T> {
  const [path = "", search = ""] = url.split("?");
  await new Promise((resolve) => setTimeout(resolve, 250));
  for (const r of routes) {
    if (r.method !== method) continue;
    const params = matchMockPathAndExtractParams(r.path, path);
    if (!params) continue;
    if (isGuest && !guestAccessMocks.isAllowedWithoutSession(method, r.path, params)) throw new ApiError(401, "Sign in to continue", "unauthorized");
    const result = r.handler({ params, query: new URLSearchParams(search), body, idempotencyKey, isGuest }) as T;
    return isGuest ? guestAccessMocks.withViewerStateCleared(result) : result;
  }
  throw new ApiError(404, `No mock for ${method} ${path}`);
}
