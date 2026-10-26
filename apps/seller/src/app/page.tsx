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
import { freePlanPromise } from "@/config/planFeatures.config";
import { readAdsManagerUrl, readMarketingSiteUrl } from "@/config/siteMetadata.config";
import { loadPublicSubscriptionPlansForVisitor } from "@/server/publicPlans.service";

import styles from "@/components/landing/landingPage.module.css";

export const metadata: Metadata = {
  title: { absolute: "Nantty Dashboard — run your business, free for every seller" },
  description: "The Nantty App lets you sell from anywhere. Nantty Dashboard is where you run your business: products, inventory, app orders with escrow, customers, analytics, marketing, payouts, team and reports. Free for every Nantty seller.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", title: "Nantty Dashboard", description: "Run your Nantty business from one screen. Free for every seller — upgrade to Pro or Business when you grow.", url: "/", images: [{ url: "/screenshots/dashboardOverview.webp", width: 2880, height: 1800, alt: "Nantty Dashboard home" }] },
};

export default async function LandingPage() {
  const { plans, locale } = await loadPublicSubscriptionPlansForVisitor();
  const marketingSiteUrl = readMarketingSiteUrl();
  return (
    <div className={styles.page}>
      <aside className={styles.announcement} aria-label="Announcement">
        <span className={styles.announcementBadge}>Free</span>
        <span>
          {freePlanPromise} <Link href="/login">Sign in with your app account</Link>
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
