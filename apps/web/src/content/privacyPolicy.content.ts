import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const privacyPolicySections: readonly LegalDocumentSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    paragraphs: [
      "Zudomart operates a Nigeria-first social commerce marketplace: the Zudomart app, this website, and the seller, creator and advertiser tools that go with them. This policy explains what personal data we collect, why, who we share it with and the choices you have.",
      "[Team to replace: registered company name, address and registration number, and the data protection contact or officer once appointed.]",
    ],
  },
  {
    id: "data-we-collect",
    heading: "Data we collect",
    paragraphs: ["Depending on how you use Zudomart, we collect the following."],
    bullets: [
      "Identity and contact details: name, username, email address and phone number.",
      "Addresses: delivery and billing addresses you save or enter at checkout.",
      "Location: country and approximate location from your device or IP address, used for currency, delivery options and relevance. Precise device location is only collected if you allow it.",
      "Purchase and search history: what you view, search for, add to cart, buy, return or review.",
      "Interactions: follows, likes, comments, shares, watch time on clips and live streams, and gifts sent or received.",
      "Device and network data: IP address, device type, operating system, app version, language and crash information.",
      "Cookies and similar technologies: see our Cookie Policy.",
      "Analytics data: how features are used and how the product performs.",
      "Advertising data: ad impressions, clicks and conversions, and the audience and interest signals used to show ads.",
      "Messages: chats with sellers and buyers, and messages you send to support, including attachments.",
      "Payment-related data: transaction references, amounts, payout details and the status of payments. Card and bank credentials are handled by our payment providers; we do not store full card numbers.",
      "Seller and creator verification data: identity, business and bank details provided for verification and payouts.",
    ],
  },
  {
    id: "purposes",
    heading: "How we use your data",
    paragraphs: ["We use personal data to:"],
    bullets: [
      "create and run your account, process orders, hold and release escrow payments and handle payouts, returns and disputes;",
      "show you relevant products, posts, clips and live streams, and measure and improve the product;",
      "show and measure ads, where you have allowed advertising;",
      "keep Zudomart safe: prevent fraud, abuse and unauthorized access, and enforce our terms;",
      "send service messages, and marketing messages where you have allowed them;",
      "meet legal, tax, accounting and regulatory obligations and respond to lawful requests.",
    ],
  },
  {
    id: "legal-basis",
    heading: "Legal basis, where applicable",
    paragraphs: [
      "Where the Nigeria Data Protection Act 2023 or the GDPR applies, we rely on one or more of these bases: performing our contract with you (accounts, orders, payments), our legitimate interests (security, fraud prevention, product improvement), compliance with legal obligations, and your consent (optional cookies, personalization, personalized ads and marketing). You can withdraw consent at any time without affecting what happened before.",
      "[Team to confirm the basis for each purpose with counsel.]",
    ],
  },
  {
    id: "sharing",
    heading: "Who we share data with",
    paragraphs: ["We do not sell your personal data. We share it only as needed with:"],
    bullets: [
      "Payment providers, currently Paystack and Flutterwave, who process payments and payouts.",
      "Sellers, who receive the details needed to fulfil your order, such as name, delivery address and phone number.",
      "Cloud hosting and infrastructure providers that store and process data for us.",
      "Cloudflare, which runs the Turnstile human check. When you are asked to complete a check, Cloudflare receives technical signals from your browser or device (such as IP address, browser characteristics and how the check was completed) to decide whether you are a person. It does not use cookies to track you across sites, and we receive only a pass or fail result.",
      "Analytics providers, only if you have allowed analytics.",
      "Advertising partners and measurement providers, only if you have allowed advertising.",
      "Delivery and logistics partners where a seller uses them.",
      "Professional advisers, regulators, courts and law enforcement where the law requires or to protect rights and safety.",
    ],
  },
  {
    id: "international-transfers",
    heading: "International transfers",
    paragraphs: [
      "Some providers may process data outside Nigeria. Where that happens we intend to use safeguards that the applicable law recognizes, such as contractual protections, and to share only what is needed.",
      "[Team to replace: list of providers and the countries where data is stored, and the transfer mechanism for each.]",
    ],
  },
  {
    id: "retention",
    heading: "Retention",
    paragraphs: [
      "We keep personal data only as long as needed for the purposes in this policy or as the law requires. Retention periods are configurable by data type, and the schedule will be published here once approved.",
      "[Team to replace: retention schedule by data type, approved by counsel.]",
      "When you delete your account, we delete or anonymize your profile and content. Orders, payments, payout and escrow records may be kept for as long as the law requires for tax, fraud and dispute purposes.",
    ],
  },
  {
    id: "security",
    heading: "Security",
    paragraphs: [
      "We use technical and organizational measures designed to protect personal data, including encryption in transit, access controls, separation of duties for staff access and logging. No system is perfectly secure. If a personal data breach affects you we will tell you and the regulator as the law requires.",
      "To protect accounts and data from unauthorised access and automated abuse, we keep security logs of requests that were refused (for example, attempts to open other people's orders, messages or payouts, or staff-only pages), recording the type of page, counts, the time, a device identifier and a shortened network address, never the content you sent. Accounts that show this pattern, or that behave like automated software, may be asked to complete a human check, sometimes on every sensitive action. Repeated failures can lead to a temporary suspension, which you can appeal. Automated systems never ban or delete accounts: a member of our team reviews the evidence first. Security logs are kept for up to 12 months, or longer while a case or appeal is open.",
    ],
  },
  {
    id: "your-rights",
    heading: "Your rights",
    paragraphs: ["Depending on where you live, you may have the right to:"],
    bullets: [
      "access the personal data we hold about you;",
      "correct data that is wrong or incomplete;",
      "delete your data, subject to what we must keep by law;",
      "withdraw consent at any time, including in the app under Settings, Privacy & Data and through the cookie settings on our websites;",
      "receive your data in a portable format;",
      "object to or restrict certain uses, and complain to the Nigeria Data Protection Commission or your local data protection authority.",
    ],
  },
  {
    id: "children",
    heading: "Children",
    paragraphs: ["Zudomart is not intended for people under the age required to form a binding contract where they live. If you believe a child has given us personal data, contact us and we will act on it."],
  },
  {
    id: "contact",
    heading: "Contact us",
    paragraphs: [`To use your rights or ask a question, email ${emailAddresses.privacy}. You can reach our Data Protection Officer at ${emailAddresses.dpo}.`],
  },
  {
    id: "updates",
    heading: "Updates to this policy",
    paragraphs: ["We will post changes on this page and update the version and effective date. We will ask for your choices again when a change affects consent, and announce significant changes in the app or by email."],
  },
];
