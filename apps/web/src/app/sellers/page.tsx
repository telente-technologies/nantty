import { AppDownloadCallToActionPanel } from "@/components/sections/appDownloadCallToAction";
import { FrequentlyAskedQuestionsAccordion } from "@/components/sections/frequentlyAskedQuestions";
import { SellerDashboardSection } from "@/components/sellers/sellerDashboardSection";
import { SellerFeesSection } from "@/components/sellers/sellerFeesSection";
import { SellerPayoutsSection } from "@/components/sellers/sellerPayoutsSection";
import { SellersPageHeroSection } from "@/components/sellers/sellersHeroSection";
import { SellerOnboardingStepsSection } from "@/components/sellers/sellerStepsSection";
import { sellerQuestions } from "@/content/sellerQuestions.content";
import { businessAppLinks } from "@/lib/siteConfig.config";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Sell on Nantty", description: "Open a Nantty store, sell through posts, clips and live streams, manage orders from the seller dashboard, and get paid to your wallet when buyers confirm delivery.", path: "/sellers" });

export default function SellersPage() {
  return (
    <>
      <SellersPageHeroSection />
      <SellerOnboardingStepsSection />
      <SellerDashboardSection />
      <SellerPayoutsSection />
      <SellerFeesSection />
      <FrequentlyAskedQuestionsAccordion questions={sellerQuestions} headingId="seller-questions-heading" heading="Seller questions." sectionId="seller-questions" />
      <AppDownloadCallToActionPanel
        sectionId="apply"
        headingId="apply-heading"
        heading="Open your store."
        description="Apply to sell from the Nantty app or the Nantty Dashboard. We review every seller before their store opens."
        actionLabel={`Apply on ${businessAppLinks.sellerDashboard.label}`}
        actionHref={businessAppLinks.sellerDashboard.href}
      />
    </>
  );
}
