"use client";

import { CookieConsentBanner, type ConsentChoice } from "@nantty/web-kit";

import { sendAdminApiRequest } from "@/services/adminApiClient.service";

const marketingSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://nantty.com";

function sendConsentChoiceToServer(choice: ConsentChoice): Promise<void> {
  return sendAdminApiRequest<void>("/admin/consents", { method: "POST", body: { policyVersion: choice.policyVersion, decidedAt: choice.decidedAt, categories: choice.categories, source: "web_banner" } });
}

export function ConsentBannerHost({ isSignedIn }: { readonly isSignedIn: boolean }) {
  return <CookieConsentBanner isSignedIn={isSignedIn} onChoiceSaved={sendConsentChoiceToServer} privacyPolicyHref={`${marketingSiteUrl}/privacy`} cookiePolicyHref={`${marketingSiteUrl}/cookies`} />;
}
