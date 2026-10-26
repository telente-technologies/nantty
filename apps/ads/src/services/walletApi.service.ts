import { sendAdsApiRequest } from "@/services/adsApiClient.service";
import type { AdsVerification, NanttyWalletSummary } from "@/types/nanttyWallet.type";

export const walletApi = {
  fetchMyWallet: () => sendAdsApiRequest<NanttyWalletSummary>("/wallets/me"),
  fetchAdsVerification: () => sendAdsApiRequest<AdsVerification>("/ads/verification"),
};
