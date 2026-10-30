import type { QuestionAndAnswer } from "@/components/sections/frequentlyAskedQuestions";
import { isPrelaunchMode } from "@/lib/siteConfig.config";

export const homeQuestions: readonly QuestionAndAnswer[] = [
  {
    question: "What is Nantty?",
    answer:
      isPrelaunchMode
        ? "Nantty is a social marketplace we’re building for Nigeria. The product is designed to bring seller and creator content, product discovery and protected checkout together; it is not open to the public yet."
        : "Nantty is a social marketplace bringing seller and creator content, product discovery and protected checkout together in supported markets.",
  },
  {
    question: "How does escrow protect me?",
    answer:
      isPrelaunchMode
        ? "For eligible Nigerian orders, the planned escrow flow keeps the funds in the buyer’s own account with our licensed payment partner while the order is protected. Nantty does not hold customer money. Release or refund follows delivery and dispute rules. Escrow is not available in every market or for every payment method."
        : "For eligible Nigerian orders, funds remain in the buyer’s own account with our licensed payment partner while escrow is active. Nantty does not hold customer money. Release or refund follows delivery and dispute rules. Escrow is not available in every market or for every payment method.",
  },
  {
    question: "What currency will I pay in?",
    answer:
      isPrelaunchMode
        ? "Supported currencies and payment methods will depend on your country and the payment options available at launch. We’ll publish the supported-market details before opening the service."
        : "Supported currencies and payment methods depend on your country and the options shown at checkout.",
  },
  {
    question: "Can I buy from more than one seller at once?",
    answer: isPrelaunchMode
      ? "That is the planned marketplace experience: one cart can include products from different stores, while each seller’s fulfilment and payment status remain separate. Availability will be confirmed before launch."
      : "Add eligible products from different stores to one cart. Each seller’s fulfilment and payment status remain separate.",
  },
  {
    question: "Who can sell on Nantty?",
    answer:
      isPrelaunchMode
        ? "Businesses and eligible individual sellers are expected to be able to apply for a store. Seller verification and review are part of the product design; application availability and requirements will be published before launch."
        : "Eligible businesses and individual sellers can apply for a store. Applications are reviewed and requirements depend on account and market eligibility.",
  },
  {
    question: "What do the blue, gold and black badges mean?",
    answer:
      "Badge colors distinguish approved personal accounts (Blue), businesses and brands (Gold), and official government accounts (Black). Verification is separate from payment, and a badge appears only after the relevant review is complete.",
  },
  {
    question: "Can creators earn on Nantty?",
    answer:
      isPrelaunchMode
        ? "Creator earning tools are still being built. Video LIVE is a gated beta capability, while affiliate, advertising and fan-subscription features depend on launch readiness and Creator Program eligibility. No earnings are guaranteed, and gifts are not being presented as an initial-launch feature."
        : "Some creator tools require separate Creator Program approval. Video LIVE remains a gated beta capability; current earning features and eligibility are shown in the program terms. Earnings are not guaranteed.",
  },
  {
    question: "When and where does Nantty launch?",
    answer: isPrelaunchMode
      ? "Nantty is still in development and is not yet open for public use. Join the waitlist for launch updates; we’ll confirm the launch date, supported countries and app availability when they are ready."
      : "Nantty is available in supported markets. Check the official app stores and Nantty web app for current availability in your country.",
  },
];
