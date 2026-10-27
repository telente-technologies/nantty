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
  title: { absolute: "Nantty Studio: the creator studio for going live" },
  description:
    "A creator home for going live on Nantty, with OBS support, overlays, audience tools and creator analytics. Studio is for Nantty Creator Program members: talk, music, gaming, education and IRL.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: "Nantty Studio",
    title: "Nantty Studio — the creator studio for going live",
    description: "A creator home for going live on Nantty, with OBS support, overlays, audience tools and creator analytics.",
    url: "/",
    images: [{ url: "/photos/creatorMicPortrait.webp", width: 1000, height: 1400, alt: "A creator speaking into a studio microphone" }],
  },
  twitter: { card: "summary_large_image", title: "Nantty Studio — the creator studio for going live", description: "A creator home for going live on Nantty, with OBS support, overlays, audience tools and creator analytics.", images: ["/photos/creatorMicPortrait.webp"] },
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
