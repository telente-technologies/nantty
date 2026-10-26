"use client";

import { CookieConsentBanner, type ConsentChoice } from "@nantty/web-kit";

import { useSession } from "@/components/providers/sessionProvider";
import { sendRequestToWebappServer } from "@/services/clientApi.service";

const marketingSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://nantty.com";

function sendConsentChoiceToServer(choice: ConsentChoice): Promise<void> {
  return sendRequestToWebappServer<void>("/api/v1/users/me/consents", { method: "PUT", body: { consents: choice.categories } });
}

export function ConsentBannerHost() {
  const { viewer } = useSession();
  return <CookieConsentBanner isSignedIn={viewer !== null} onChoiceSaved={sendConsentChoiceToServer} privacyPolicyHref={`${marketingSiteUrl}/privacy`} cookiePolicyHref={`${marketingSiteUrl}/cookies`} />;
}
