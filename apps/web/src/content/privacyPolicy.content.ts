import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { contactEmailDisplayText, contactMailtoHref, siteConfig } from "@/lib/siteConfig.config";

export const privacyPolicySections: readonly LegalDocumentSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    paragraphs: [
      "Zudomart operates a social marketplace app and this website. This policy explains what personal data we collect, why we collect it, and the choices you have.",
      "[Team to replace: registered company name, address and registration number.]",
    ],
  },
  {
    id: "data-we-collect",
    heading: "Data we collect",
    paragraphs: [
      "Waitlist: when you join the waitlist on this website we collect your email address, whether you want to shop or sell, and which form you used.",
      "App accounts: when the app launches, we will collect account details such as your name, username, phone number or email, delivery addresses, orders, messages with sellers, and content you post.",
      "Sellers: store applications include identity, business and bank details used for verification and payouts.",
      "Technical data: our servers log basic request information such as IP address, device type and the approximate country used to show prices in your local currency.",
    ],
  },
  {
    id: "how-we-use-data",
    heading: "How we use your data",
    paragraphs: [
      "To send you launch updates you asked for, to run your account and orders, to hold and release escrow payments, to verify sellers, to prevent fraud, and to meet legal obligations.",
      "We do not sell your personal data.",
    ],
  },
  {
    id: "sharing",
    heading: "Who we share it with",
    paragraphs: [
      "Payment providers who process payments and payouts, delivery partners who deliver your orders, and service providers who host and secure our systems. Sellers receive the details needed to fulfil your order.",
      "[Team to replace: list of processors and the countries where data is stored.]",
    ],
  },
  {
    id: "your-rights",
    heading: "Your rights",
    paragraphs: [
      "Depending on where you live, including under the Nigeria Data Protection Act 2023, you may have the right to access, correct, delete or move your data, and to object to certain uses.",
      `To make a request, email ${contactEmailDisplayText}. You can leave the waitlist at any time using the link in our emails.`,
    ],
  },
  {
    id: "retention-security",
    heading: "Retention and security",
    paragraphs: [
      "We keep data only as long as needed for the purposes above or as the law requires, and we protect it with access controls and encryption in transit.",
      "[Team to replace: specific retention periods.]",
    ],
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    paragraphs: ["We will post any changes on this page and update the date at the top. Significant changes will also be announced in the app or by email."],
  },
];
