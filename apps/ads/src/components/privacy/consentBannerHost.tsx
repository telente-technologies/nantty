"use client";

import { CookieConsentBanner, type ConsentChoice } from "@zudomart/web-kit";

import { sendAdsApiRequest } from "@/services/adsApiClient.service";

const marketingSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com";

function sendConsentChoiceToServer(choice: ConsentChoice): Promise<void> {
  return sendAdsApiRequest<void>("/users/me/consents", { method: "PUT", body: { policyVersion: choice.policyVersion, consents: choice.categories } });
}

export function ConsentBannerHost({ isSignedIn }: { readonly isSignedIn: boolean }) {
  return <CookieConsentBanner isSignedIn={isSignedIn} onChoiceSaved={sendConsentChoiceToServer} privacyPolicyHref={`${marketingSiteUrl}/privacy`} cookiePolicyHref={`${marketingSiteUrl}/cookies`} />;
}
