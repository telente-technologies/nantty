import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AdFormatsSection } from "@/components/landing/adFormatsSection";
import { CampaignStepsSection } from "@/components/landing/campaignStepsSection";
import { FeatureShowcaseSections, PolicyAndReviewSection } from "@/components/landing/featureShowcaseSections";
import { LandingFooterWithContact } from "@/components/landing/landingFooter";
import { LandingHeaderWithFloatingNavigation } from "@/components/landing/landingHeader";
import { LandingHeroWithProductStage } from "@/components/landing/landingHero";
import { LandingFinalCallToAction, LandingQuestionsSection } from "@/components/landing/landingQuestionsAndCallToAction";
import { WhatIsZudomartAdsSection } from "@/components/landing/whatIsZudomartAdsSection";
import landingLayoutStyles from "@/components/landing/landingLayout.module.css";
import { buildSessionViewFromCookies } from "@/server/adsSessionView.service";

export const metadata: Metadata = {
  title: { absolute: "Zudomart Ads — advertise across the Zudomart marketplace" },
  description: "Run ads on Zudomart Marketplace, Feed, Reels and Live. Target buyers across Nigeria and beyond, pay in your local currency and see which ads turned into orders.",
  robots: { index: true, follow: true },
};

export default async function LandingPage() {
  const isSignedIn = buildSessionViewFromCookies(await cookies()) !== null;
  const primaryAction = isSignedIn ? { href: "/accounts", label: "Open Ads Manager" } : { href: "/login", label: "Sign in with your Zudomart account" };
  return (
    <div className={landingLayoutStyles.page}>
      <LandingHeaderWithFloatingNavigation primaryAction={primaryAction} />
      <main id="main-content">
        <LandingHeroWithProductStage primaryAction={primaryAction} isSignedIn={isSignedIn} />
        <WhatIsZudomartAdsSection />
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
