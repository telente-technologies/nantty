import type { Metadata } from "next";

import { LandingCallToAction } from "@/components/landing/landingCallToAction";
import { LandingFeatures } from "@/components/landing/landingFeatures";
import { LandingFooter } from "@/components/landing/landingFooter";
import { LandingHeader } from "@/components/landing/landingHeader";
import { LandingHero } from "@/components/landing/landingHero";
import landingLayoutStyles from "@/components/landing/landingPage.module.css";
import { LandingSteps } from "@/components/landing/landingSteps";

export const metadata: Metadata = {
  title: { absolute: "Zudomart Studio — go live, earn gifts and grow your audience" },
  description: "Connect OBS with an RTMP server URL and stream key, build text and logo overlays on a browser source, receive gifts, battle with guests and chat with viewers from one creator control room. Selling is optional.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function LandingPage() {
  return (
    <div className={landingLayoutStyles.page}>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <LandingHero />
        <LandingFeatures />
        <LandingSteps />
        <LandingCallToAction />
      </main>
      <LandingFooter />
    </div>
  );
}
