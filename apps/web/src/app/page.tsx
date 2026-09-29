import { AppDownloadCallToActionPanel } from "@/components/sections/appDownloadCallToAction";
import { BuyerJourneyStepsSection } from "@/components/sections/buyerJourneySection";
import { ScrollingShoppingCategoryMarquee } from "@/components/sections/categoryMarquee";
import { EscrowTrustSection } from "@/components/sections/escrowTrustSection";
import { FrequentlyAskedQuestionsAccordion } from "@/components/sections/frequentlyAskedQuestions";
import { HomeHeroSectionWithPhoneStage } from "@/components/sections/heroSection";
import { SellersTeaserSection } from "@/components/sections/sellersTeaserSection";
import { SocialShoppingFeatureTabsSection } from "@/components/sections/socialShoppingSection";
import { homeQuestions } from "@/content/homeQuestions.content";

export default function HomePage() {
  return (
    <>
      <HomeHeroSectionWithPhoneStage />
      <ScrollingShoppingCategoryMarquee />
      <BuyerJourneyStepsSection />
      <EscrowTrustSection />
      <SocialShoppingFeatureTabsSection />
      <SellersTeaserSection />
      <FrequentlyAskedQuestionsAccordion questions={homeQuestions} />
      <AppDownloadCallToActionPanel />
    </>
  );
}
