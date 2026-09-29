import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { siteConfig } from "@/lib/siteConfig.config";

export const termsOfServiceSections: readonly LegalDocumentSection[] = [
  {
    id: "agreement",
    heading: "Agreement to these terms",
    paragraphs: [
      "These terms apply when you use the Zudomart website, join the waitlist, or use the Zudomart app. By using them you agree to these terms.",
      "[Team to replace: legal entity name and governing law.]",
    ],
  },
  {
    id: "accounts",
    heading: "Accounts",
    paragraphs: [
      "You must give accurate information, keep your login details safe, and be old enough to form a binding contract where you live. You are responsible for activity on your account.",
    ],
  },
  {
    id: "buying",
    heading: "Buying on Zudomart",
    paragraphs: [
      "Products are sold by independent sellers, not by Zudomart. Prices are shown in your local currency where supported, and otherwise in US dollars.",
      "When you pay, the money is held in escrow. It is released to the seller when you confirm delivery, or after a set period if you do not confirm or open a dispute.",
      "[Team to replace: automatic release period and dispute window.]",
    ],
  },
  {
    id: "selling",
    heading: "Selling on Zudomart",
    paragraphs: [
      "Sellers must be approved before listing. Sellers must describe products accurately, ship on time, and follow our prohibited items list and applicable law.",
      "Seller fees will be published before they apply. Payouts are made to a verified bank account after escrow is released.",
    ],
  },
  {
    id: "disputes",
    heading: "Disputes and refunds",
    paragraphs: [
      "If an order does not arrive or is not as described, open a dispute before confirming delivery. Zudomart will review the evidence from both sides and decide whether to refund the buyer or release payment to the seller.",
    ],
  },
  {
    id: "content",
    heading: "Your content",
    paragraphs: [
      "You keep ownership of the posts, clips, stories and live streams you create. You give Zudomart a licence to host and show them in the app so others can see and shop from them.",
      "Do not post content that is illegal, misleading, or infringes someone else's rights.",
    ],
  },
  {
    id: "liability",
    heading: "Limits of liability",
    paragraphs: ["[Team to replace: limitation of liability and warranty disclaimers reviewed by counsel.]"],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: [`Questions about these terms can be sent to ${siteConfig.contactEmails.general}.`],
  },
];
