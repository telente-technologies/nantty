import type { Metadata } from "next";

import { AppDownloadCallToActionPanel } from "@/components/sections/appDownloadCallToAction";
import { FrequentlyAskedQuestionsAccordion } from "@/components/sections/frequentlyAskedQuestions";
import { SellerDashboardSection } from "@/components/sellers/sellerDashboardSection";
import { SellerFeesPlaceholderSection } from "@/components/sellers/sellerFeesSection";
import { SellerPayoutsSection } from "@/components/sellers/sellerPayoutsSection";
import { SellersPageHeroSection } from "@/components/sellers/sellersHeroSection";
import { SellerOnboardingStepsSection } from "@/components/sellers/sellerStepsSection";
import { sellerQuestions } from "@/content/sellerQuestions.content";

export const metadata: Metadata = {
  title: "Sell on Zudomart",
  description: "Open a Zudomart store, sell through posts, clips and live streams, manage orders from the seller dashboard, and get paid to your wallet when buyers confirm delivery.",
  alternates: { canonical: "/sellers" },
  openGraph: { title: "Sell on Zudomart", url: "/sellers" },
};

export default function SellersPage() {
  return (
    <>
      <SellersPageHeroSection />
      <SellerOnboardingStepsSection />
      <SellerDashboardSection />
      <SellerPayoutsSection />
      <SellerFeesPlaceholderSection />
      <FrequentlyAskedQuestionsAccordion questions={sellerQuestions} headingId="seller-questions-heading" heading="Seller questions." sectionId="seller-questions" />
      <AppDownloadCallToActionPanel
        sectionId="apply"
        headingId="apply-heading"
        heading="Open your store early."
        description="Seller applications open in the app at launch. Join the seller waitlist and we'll invite you to apply first."
        defaultRole="seller"
        source="web-sellers"
      />
    </>
  );
}
