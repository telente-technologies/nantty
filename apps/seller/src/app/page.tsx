import type { Metadata } from "next";
import Link from "next/link";

import { LandingAccessSteps } from "@/components/landing/landingAccessSteps";
import { LandingCallToAction } from "@/components/landing/landingCallToAction";
import { LandingFeatures } from "@/components/landing/landingFeatures";
import { LandingFooter } from "@/components/landing/landingFooter";
import { LandingHeader } from "@/components/landing/landingHeader";
import { LandingHero } from "@/components/landing/landingHero";
import { LandingPricing } from "@/components/landing/landingPricing";
import { LandingQuestions } from "@/components/landing/landingQuestions";
import { LandingSyncSection } from "@/components/landing/landingSyncSection";
import { LandingTicker } from "@/components/landing/landingTicker";
import { readAdsManagerUrl, readMarketingSiteUrl } from "@/config/siteMetadata.config";
import { loadPublicGoldPlansForVisitor } from "@/server/publicPlans.service";

import styles from "@/components/landing/landingPage.module.css";

export const metadata: Metadata = {
  title: { absolute: "Zudomart Dashboard — point of sale and back office for Gold sellers" },
  description: "Run your Zudomart store from one screen: a point of sale that works offline, stock across locations, online orders with escrow, customers, staff, reports and payouts. Sign in with your Zudomart account.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", title: "Zudomart Dashboard", description: "The point of sale and back office for Gold-verified Zudomart businesses.", url: "/", images: [{ url: "/screenshots/dashboardOverview.webp", width: 2880, height: 1800, alt: "Zudomart Dashboard home" }] },
};

export default async function LandingPage() {
  const { plans, locale } = await loadPublicGoldPlansForVisitor();
  const marketingSiteUrl = readMarketingSiteUrl();
  return (
    <div className={styles.page}>
      <aside className={styles.announcement} aria-label="Announcement">
        <span className={styles.announcementBadge}>Gold</span>
        <span>
          Included with Gold Pro and Gold Premium. <Link href="/login">Sign in with your app account</Link>
        </span>
      </aside>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <LandingHero />
        <LandingTicker />
        <LandingFeatures />
        <LandingSyncSection />
        <LandingAccessSteps />
        <LandingPricing plans={plans} locale={locale} />
        <LandingQuestions />
        <LandingCallToAction getTheAppUrl={marketingSiteUrl} />
      </main>
      <LandingFooter marketingSiteUrl={marketingSiteUrl} adsManagerUrl={readAdsManagerUrl()} />
    </div>
  );
}
