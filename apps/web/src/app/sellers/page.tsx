import { AppDownloadCallToActionPanel } from "@/components/sections/appDownloadCallToAction";
import { FrequentlyAskedQuestionsAccordion } from "@/components/sections/frequentlyAskedQuestions";
import { SellerDashboardSection } from "@/components/sellers/sellerDashboardSection";
import { SellerFeesSection } from "@/components/sellers/sellerFeesSection";
import { SellerPayoutsSection } from "@/components/sellers/sellerPayoutsSection";
import { SellersPageHeroSection } from "@/components/sellers/sellersHeroSection";
import { SellerOnboardingStepsSection } from "@/components/sellers/sellerStepsSection";
import { sellerQuestions } from "@/content/sellerQuestions.content";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({ title: "Selling on Nantty", description: "See the seller experience Nantty is building for Nigeria. Store onboarding and the seller workspace are not open to the public yet.", path: "/sellers" });

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
        heading="Get ready to sell with Nantty."
        description="Seller onboarding and the seller workspace are still in development. Join the waitlist for launch updates; joining does not guarantee store approval."
        actionLabel="Join the waitlist"
        actionHref="/waitlist"
      />
    </>
  );
}
