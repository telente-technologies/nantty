import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import { LandingCallToAction } from "@/components/landing/landingCallToAction";
import { LandingCategories } from "@/components/landing/landingCategories";
import { LandingEarnings } from "@/components/landing/landingEarnings";
import { LandingFaq } from "@/components/landing/landingFaq";
import { LandingFeatureBento } from "@/components/landing/landingFeatureBento";
import { LandingFooter } from "@/components/landing/landingFooter";
import { LandingGoLiveModes } from "@/components/landing/landingGoLiveModes";
import { LandingHeader } from "@/components/landing/landingHeader";
import { LandingHero } from "@/components/landing/landingHero";
import landingStyles from "@/components/landing/landingPage.module.css";
import { LandingSteps } from "@/components/landing/landingSteps";
import { LandingTicker } from "@/components/landing/landingTicker";

const monoFont = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-landing-mono", weight: ["400", "600"] });

export const metadata: Metadata = {
  title: { absolute: "Zudomart Studio: the creator studio for going live" },
  description:
    "Go live from your phone or OBS, bring up to 10 creators on stage, battle for gifts, run overlays and moderation, and get paid to your bank. Studio is for Zudomart Creator Program members: talk, music, gaming, education and IRL.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Zudomart Studio",
    description: "The creator studio for going live on Zudomart: phone or OBS, multi-guest battles, gifts, subscriptions and payouts to your bank.",
    images: [{ url: "/photos/creatorMicPortrait.webp", width: 1000, height: 1400, alt: "A creator speaking into a studio microphone" }],
  },
};

export default function LandingPage() {
  return (
    <div className={`${landingStyles.page} ${monoFont.variable}`}>
      <LandingHeader />
      <main id="main-content" tabIndex={-1} className={landingStyles.main}>
        <LandingHero />
        <LandingTicker />
        <LandingGoLiveModes />
        <LandingFeatureBento />
        <LandingEarnings />
        <LandingCategories />
        <LandingSteps />
        <LandingFaq />
        <LandingCallToAction />
      </main>
      <LandingFooter />
    </div>
  );
}
