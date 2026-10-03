import { adEventsMocks } from "./adEvents.mock";
import { authMocks } from "./auth.mock";
import { banksMocks } from "./banks.mock";
import { boostsMocks } from "./boosts.mock";
import { brandsMocks } from "./brands.mock";
import { cartMocks } from "./cart.mock";
import { chatsMocks } from "./chats.mock";
import { groupsMocks } from "./groups.mock";
import { clipsMocks } from "./clips.mock";
import { coinsMocks } from "./coins.mock";
import { commentsMocks } from "./comments.mock";
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
import { privacyMocks } from "./privacy.mock";
import { productsMocks } from "./products.mock";
import { rewardsMocks } from "./rewards.mock";
import type { MockRoute } from "./registry.mock";
import { sellerMocks } from "./seller.mock";
import { settingsMocks } from "./settings.mock";
import { storiesMocks } from "./stories.mock";
import { supportMocks } from "./support.mock";
import { usernameMocks } from "./username.mock";
import { usersMocks } from "./users.mock";
import { verificationMocks } from "./verification.mock";
import { walletMocks } from "./wallet.mock";
import { reportsMocks } from "./reports.mock";
import { discoveryMocks } from "./discovery.mock";
import { savesMocks } from "./saves.mock";
import { videosMocks } from "./videos.mock";

export const routes: MockRoute[] = [
  ...localeMocks,
  ...usernameMocks,
  ...authMocks,
  ...discoveryMocks,
  ...savesMocks,
  ...videosMocks,
  ...usersMocks,
  ...feedMocks,
  ...postsMocks,
  ...productsMocks,
  ...cartMocks,
  ...ordersMocks,
  ...disputesMocks,
  ...banksMocks,
  ...creatorSubscriptionsMocks,
  ...creatorProgramMocks,
  ...rewardsMocks,
  ...verificationMocks,
  ...boostsMocks,
  ...brandsMocks,
  ...supportMocks,
  ...groupsMocks,
  ...chatsMocks,
  ...clipsMocks,
  ...commentsMocks,
  ...soundsMocks,
  ...mediaMocks,
  ...adEventsMocks,
  ...reportsMocks,
  ...coinsMocks,
  ...notificationsMocks,
  ...liveMocks.filter((route) => route.path === "/api/v1/lives/suggested"),
  ...creatorsMocks,
  ...giftsMocks,
  ...liveMocks,
  ...storiesMocks,
  ...settingsMocks,
  ...privacyMocks,
  ...walletMocks,
  ...sellerMocks,
];
