import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

import { generalLegalCreditParagraph, legalEntityPlaceholder } from "./legalPlaceholders.content";
import { privacyPolicyCountryAnnexSections } from "./privacyPolicyAnnexes.content";
import { privacyPolicyProcessingSections } from "./privacyPolicyProcessing.content";

const privacyPolicyIntroductionSections: readonly LegalDocumentSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    paragraphs: [
      `Nantty is a Nigeria-first social marketplace: the Nantty app, web app and website, and the seller, creator and advertiser tools that go with them. The data controller responsible for your personal data is ${legalEntityPlaceholder} ("Nantty", "we").`,
      `Our Data Protection Officer (DPO) can be reached at ${emailAddresses.dpo}. [Team to replace: the DPO's name or office, and Nantty's registration number with the Nigeria Data Protection Commission (NDPC) once issued.]`,
      "This policy explains what personal data we collect, why, who we share it with, how long we keep it and the rights you have. It is written to meet the Nigeria Data Protection Act 2023 (NDPA) and the NDPC's General Application and Implementation Directive 2025 (GAID). The annexes at the end add what the laws of Ghana, Kenya, South Africa, the UK, the EU and the US require.",
    ],
  },
  {
    id: "data-we-collect",
    heading: "Data we collect",
    paragraphs: ["Depending on how you use Nantty, we collect the following."],
    bullets: [
      "Account data: email address (you sign in with email, or with Apple or Google linked to that email), date of birth, username, display name, password hash, profile photo, bio, profile type, whether your account is private, and settings. Your phone number is only used as contact data for deliveries, stores and orders, never to log in.",
      "Addresses and contact details you give for delivery, billing or your store.",
      "Location: your country and approximate location from your IP address or device, used for currency, prices, delivery options and relevance. Precise location only if you allow it in your device settings, for example to share a location in a chat. We do not upload your phone contacts.",
      "Content: posts, clips, stories, lives and recordings, comments, mentions, product listings, reviews and the metadata that comes with them, including whether content is labelled or detected as AI-generated.",
      "Live safety samples: short samples of live video frames and audio, checked automatically for severe harm and deleted after a day.",
      "Activity: follows and follow requests, likes, shares, saves, searches (your last 20 per search area, until you clear them), watch time, products viewed and bought, affiliate links you clicked, gifts, tips and coins sent and received, Nantty Points, and the reasons you report or hide things.",
      "Chat data: who is in each chat, including group chats, who sent each message and when, the message type, delivery and read status, reactions, the chat folder and the public keys your devices use for end-to-end encryption. We cannot read message content or encrypted media. Locations and polls shared in chats are not end-to-end encrypted, so we store them. Encrypted chat media is deleted from our servers after 30 days.",
      "Payment and wallet data: transaction references, amounts, fees, escrow status, wallet balances held by our payment partner in your name, coin balances and coins owed, ad balance and ad credit, creator earnings and affiliate commissions, payout account details and payout history. Card numbers are entered only on our payment partner's secure page; we never see or store them.",
      "Verification data: in Nigeria, your BVN and bank account details checked through our payment partner; your legal name, date of birth and address; ID document type and number (such as NIN, passport or driver's licence); and, for Smile ID checks, ID images, a liveness selfie and a face-match result.",
      "Business data for sellers, brands and advertisers: business name, registration number, documents, tax details and the people who act for the business.",
      "Support data: tickets, live chats with our support team (these are not end-to-end encrypted) and attachments.",
      "Device and network data: IP address, device model, operating system, app version, language, push token, crash data and security signals such as failed checks.",
      "Cookies and similar technologies, as explained in our Cookie Policy.",
      "Advertising data: ad impressions, clicks and conversions measured inside Nantty, your plan (which sets how many ads you see), and the interest and audience signals used to choose ads, only where you have allowed personalised ads.",
    ],
  },
  {
    id: "sensitive-data",
    heading: "Sensitive data, biometrics and ID numbers",
    paragraphs: [
      "Some data is sensitive under the NDPA, such as biometric data, or high risk, such as BVN, NIN and ID images. We collect it only for verification, fraud prevention and legal compliance, and only when you start a verification.",
      "We ask for your explicit consent before any biometric check, and we record the version of the consent text you agreed to and when. Smile ID runs a liveness check, compares your selfie with your ID photo and returns a result. Nantty does not create or store face templates or your ID images; we keep the result, the match scores, the document type and country, and a fingerprint of the document number so it cannot be reused on another account. [Team to confirm how long Smile ID keeps images and selfies under its contract with us.]",
      "If you do not want a biometric check, you can still use Nantty, but you cannot get a checkmark, and outside Nigeria you cannot sell or receive payouts.",
    ],
  },
  {
    id: "sources",
    heading: "Where data comes from",
    paragraphs: ["Most data comes from you and your devices. We also receive data from:"],
    bullets: [
      "our payment partner (Flutterwave) about payments, wallet funding, payouts, chargebacks and bank account checks;",
      "Smile ID about identity and liveness checks;",
      "Apple and Google about in-app purchases, refunds and push notifications;",
      "Apple and Google, if you sign in with them;",
      "advertisers who upload a customer list, which we receive as hashed emails or phone numbers and match inside Nantty;",
      "other users, for example when they tag or mention you, report you, review an order, send you a follow or chat request, or share an affiliate link you click;",
      "sellers, about the fulfilment of your orders;",
      "public sources and authorities, for example sanctions lists and lawful requests.",
    ],
  },
];

const privacyPolicyClosingSections: readonly LegalDocumentSection[] = [
  {
    id: "contact",
    heading: "Contact us and complaints",
    paragraphs: [
      `To use your rights or ask a question, use Settings, Privacy & Data in the app, email ${emailAddresses.privacy}, or contact our Data Protection Officer at ${emailAddresses.dpo}. The Data rights requests page explains how we handle requests and how long we take.`,
      "If you are not happy with our answer, you can complain to the Nigeria Data Protection Commission (ndpc.gov.ng) or to the data protection authority where you live, listed in the annexes below. You do not have to contact us first, but we would like the chance to fix the problem.",
    ],
  },
  {
    id: "updates",
    heading: "Updates to this policy",
    paragraphs: ["We post changes on this page and update the version and effective date. Earlier versions stay available. We tell you by email and in the app before a material change, and we ask for your choices again when a change affects consent."],
  },
  {
    id: "credits",
    heading: "About this document",
    paragraphs: [generalLegalCreditParagraph],
  },
];

export const privacyPolicySections: readonly LegalDocumentSection[] = [
  ...privacyPolicyIntroductionSections,
  ...privacyPolicyProcessingSections,
  ...privacyPolicyCountryAnnexSections,
  ...privacyPolicyClosingSections,
];
