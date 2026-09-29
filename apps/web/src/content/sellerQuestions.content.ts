import type { QuestionAndAnswer } from "@/components/sections/frequentlyAskedQuestions";

export const sellerQuestions: readonly QuestionAndAnswer[] = [
  {
    question: "Do I need a registered business to sell?",
    answer:
      "No. Individuals and registered businesses can both apply. We ask for identity and bank details so we can verify you and pay you out. Registered businesses can add their registration details for extra trust.",
  },
  {
    question: "How long does the review take?",
    answer: "We aim to review applications within a few working days. You will get a notification in the app when your store is approved or if we need more information.",
  },
  {
    question: "When do I get paid for a sale?",
    answer:
      "The buyer's payment is held in escrow while the order is on its way. Once they confirm delivery, the money moves to your Zudomart wallet and you can withdraw it to your bank account.",
  },
  {
    question: "What happens if a buyer opens a dispute?",
    answer:
      "The payment stays in escrow while both sides share details and evidence in the app. The Zudomart team reviews the case and decides whether to release the payment to you or refund the buyer.",
  },
  {
    question: "Can I sell through live streams?",
    answer: "Yes. Approved sellers can go live, pin products during the stream, and let viewers buy without leaving the live.",
  },
];
