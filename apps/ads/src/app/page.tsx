import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AdFormatsSection } from "@/components/landing/adFormatsSection";
import { CampaignStepsSection } from "@/components/landing/campaignStepsSection";
import { FeatureShowcaseSections, PolicyAndReviewSection } from "@/components/landing/featureShowcaseSections";
import { LandingFooterWithContact } from "@/components/landing/landingFooter";
import { LandingHeaderWithFloatingNavigation } from "@/components/landing/landingHeader";
import { LandingHeroWithProductStage } from "@/components/landing/landingHero";
import { LandingFinalCallToAction, LandingQuestionsSection } from "@/components/landing/landingQuestionsAndCallToAction";
import { WhatIsNanttyAdsSection } from "@/components/landing/whatIsNanttyAdsSection";
import landingLayoutStyles from "@/components/landing/landingLayout.module.css";
import { buildSessionViewFromCookies } from "@/server/adsSessionView.service";

export const metadata: Metadata = {
  title: { absolute: "Nantty Ads — advertise across the Nantty marketplace" },
  description: "Run ads on Nantty Marketplace, Feed, Reels and Live. Target buyers across Nigeria and beyond, pay in your local currency and see which ads turned into orders.",
  robots: { index: true, follow: true },
};

export default async function LandingPage() {
  const isPrelaunchStatic = process.env.NANTTY_CLOUDFLARE_PRELAUNCH === "1";
  const isSignedIn = isPrelaunchStatic ? false : buildSessionViewFromCookies(await cookies()) !== null;
  const primaryAction = isPrelaunchStatic
    ? { href: "/login", label: "Sign in with your Nantty account", locked: true }
    : isSignedIn
      ? { href: "/accounts", label: "Open Ads Manager" }
      : { href: "/login", label: "Sign in with your Nantty account" };
  return (
    <div className={landingLayoutStyles.page}>
      <LandingHeaderWithFloatingNavigation primaryAction={primaryAction} />
      <main id="main-content">
        <LandingHeroWithProductStage primaryAction={primaryAction} isSignedIn={isSignedIn} />
        <WhatIsNanttyAdsSection />
        <AdFormatsSection />
        <CampaignStepsSection />
        <FeatureShowcaseSections />
        <PolicyAndReviewSection />
        <LandingQuestionsSection />
        <LandingFinalCallToAction primaryAction={primaryAction} isSignedIn={isSignedIn} />
      </main>
      <LandingFooterWithContact />
    </div>
  );
}
