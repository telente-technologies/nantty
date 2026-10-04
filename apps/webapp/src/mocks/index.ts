import { accountHealthMocks } from "./accountHealth.mock";
import { adEventsMocks } from "./adEvents.mock";
import { authMocks } from "./auth.mock";
import { banksMocks } from "./banks.mock";
import { boostsMocks } from "./boosts.mock";
import { brandsMocks } from "./brands.mock";
import { cartMocks } from "./cart.mock";
import { geoMocks } from "./geo.mock";
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
import { feedMocks } from "./feed.mock";
import { giftsMocks } from "./gifts.mock";
import { liveMocks } from "./live.mock";
import { localeMocks } from "./locale.mock";
import { mediaMocks } from "./media.mock";
import { notificationsMocks } from "./notifications.mock";
import { ordersMocks } from "./orders.mock";
import { postsMocks } from "./posts.mock";
import { taggedUsersMocks } from "./taggedUsers.mock";
import { postAudienceMocks } from "./postAudience.mock";
import { legalMocks } from "./legal.mock";
import { celebrationsMocks } from "./celebrations.mock";
import { notificationPreferencesMocks } from "./notificationPreferences.mock";
import { privacyMocks } from "./privacy.mock";
import { productsMocks } from "./products.mock";
import type { MockRoute } from "./registry.mock";
import { sellerMocks } from "./seller.mock";
import { settingsMocks } from "./settings.mock";
import { storiesMocks } from "./stories.mock";
import { helpCentreMocks } from "./helpCentre.mock";
import { supportMocks } from "./support.mock";
import { usernameMocks } from "./username.mock";
import { usersMocks } from "./users.mock";
import { verificationMocks } from "./verification.mock";
import { identityVerificationMocks } from "./identityVerification.mock";
import { storeRewardsMocks } from "./storeRewards.mock";
import { walletMocks } from "./wallet.mock";
import { chatReportsMocks } from "./chatReports.mock";
import { reportsMocks } from "./reports.mock";
import { discoveryMocks } from "./discovery.mock";
import { exploreMocks } from "./explore.mock";
import { savesMocks } from "./saves.mock";
import { webActionsMocks } from "./webActions.mock";
import { mentionsMocks } from "./mentions.mock";
import { videosMocks } from "./videos.mock";
import { sitemapMocks } from "./sitemap.mock";
import { linkPreviewsMocks } from "./linkPreviews.mock";
import { securityMocks } from "./security.mock";

export const routes: MockRoute[] = [
  ...localeMocks,
  ...usernameMocks,
  ...authMocks,
  ...discoveryMocks,
  ...exploreMocks,
  ...savesMocks,
  ...webActionsMocks,
  ...mentionsMocks,
  ...videosMocks,
  ...sitemapMocks,
  ...linkPreviewsMocks,
  ...securityMocks,
  ...usersMocks,
  ...feedMocks,
  ...postAudienceMocks,
  ...taggedUsersMocks,
  ...postsMocks,
  ...productsMocks,
  ...cartMocks,
  ...geoMocks,
  ...ordersMocks,
  ...disputesMocks,
  ...banksMocks,
  ...creatorSubscriptionsMocks,
  ...creatorProgramMocks,
  ...identityVerificationMocks,
  ...verificationMocks,
  ...boostsMocks,
  ...brandsMocks,
  ...helpCentreMocks,
  ...supportMocks,
  ...groupsMocks,
  ...chatsMocks,
  ...clipsMocks,
  ...commentsMocks,
  ...postThreadMocks,
  ...soundsMocks,
  ...mediaMocks,
  ...adEventsMocks,
  ...accountHealthMocks,
  ...reportsMocks,
  ...chatReportsMocks,
  ...coinsMocks,
  ...notificationsMocks,
  ...liveMocks.filter((route) => route.path === "/api/v1/lives/suggested"),
  ...creatorsMocks,
  ...giftsMocks,
  ...liveMocks,
  ...storiesMocks,
  ...settingsMocks,
  ...privacyMocks,
  ...celebrationsMocks,
  ...notificationPreferencesMocks,
  ...legalMocks,
  ...storeRewardsMocks,
  ...walletMocks,
  ...sellerMocks,
];
