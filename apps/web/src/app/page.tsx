import { AppDownloadCallToActionPanel } from "@/components/sections/appDownloadCallToAction";
import { BuyerJourneyStepsSection } from "@/components/sections/buyerJourneySection";
import { ScrollingShoppingCategoryMarquee } from "@/components/sections/categoryMarquee";
import { CreatorProgramSection } from "@/components/sections/creatorProgramSection";
import { EscrowTrustSection } from "@/components/sections/escrowTrustSection";
import { FrequentlyAskedQuestionsAccordion } from "@/components/sections/frequentlyAskedQuestions";
import { HomeHeroSectionWithPhoneStage } from "@/components/sections/heroSection";
import { SellersTeaserSection } from "@/components/sections/sellersTeaserSection";
import { SocialShoppingFeatureTabsSection } from "@/components/sections/socialShoppingSection";
import { VerificationBadgesSection } from "@/components/sections/verificationBadgesSection";
import { homeQuestions } from "@/content/homeQuestions.content";
import { NanttyPrelaunchSection } from "@/components/nantty/nanttyPrelaunchSection";

const isPrelaunchMode = process.env.NEXT_PUBLIC_PRELAUNCH_MODE !== "false";

export default function HomePage() {
  return (
    <>
      <HomeHeroSectionWithPhoneStage />
      <ScrollingShoppingCategoryMarquee />
      <BuyerJourneyStepsSection />
      <EscrowTrustSection />
      <SocialShoppingFeatureTabsSection />
      <VerificationBadgesSection />
      <CreatorProgramSection />
      <SellersTeaserSection />
      <FrequentlyAskedQuestionsAccordion questions={homeQuestions} />
      <AppDownloadCallToActionPanel />
      {isPrelaunchMode ? <NanttyPrelaunchSection /> : null}
    </>
  );
}
