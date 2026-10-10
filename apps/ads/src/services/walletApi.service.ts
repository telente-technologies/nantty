import { sendAdsApiRequest } from "@/services/adsApiClient.service";
import type { AdsVerification, ZudomartWalletSummary } from "@/types/zudomartWallet.type";

export const walletApi = {
  fetchMyWallet: () => sendAdsApiRequest<ZudomartWalletSummary>("/wallets/me"),
  fetchAdsVerification: () => sendAdsApiRequest<AdsVerification>("/ads/verification"),
};
