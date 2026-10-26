import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

import { generalLegalCreditParagraph } from "./legalPlaceholders.content";

export const cookiePolicySections: readonly LegalDocumentSection[] = [
  {
    id: "what-are-cookies",
    heading: "What cookies are",
    paragraphs: [
      "Cookies are small files a website stores on your device. Session cookies expire when you close the browser; persistent cookies stay until they expire or you delete them. We also use similar technologies: browser local storage, and in our apps, secure device storage and software development kits (SDKs). This policy covers all of them, on our websites (nantty.com, the web app, the seller dashboard, Creator Studio and Nantty Ads) and our apps. It sits alongside our Privacy Policy.",
    ],
  },
  {
    id: "categories",
    heading: "Categories we use",
    paragraphs: [
      "Optional categories stay off until you allow them, and their scripts are not loaded before you choose. Our banner lets you accept all, reject all or choose by category, with rejecting as easy as accepting, as the NDPC's GAID and the UK and EU rules expect.",
    ],
    table: {
      columns: ["Category", "Purpose", "Your choice"],
      rows: [
        ["Essential", "Keep you signed in, protect your account and our systems from abuse, remember your theme and your cookie choice.", "Always on. The service cannot work without them."],
        ["Analytics", "Understand how features are used and how the product performs so we can fix problems and improve it.", "Off until you allow it."],
        ["Personalisation", "Remember preferences and tailor what you see, such as suggestions.", "Off until you allow it."],
        ["Advertising", "Measure ads and show ads that are more relevant to you. Never used for under-18 accounts.", "Off until you allow it."],
      ],
    },
  },
  {
    id: "cookies-in-use",
    heading: "Cookies and storage we use today",
    paragraphs: [
      "On live sites, sign-in cookies carry the __Host- prefix, which locks them to our domain and secure connections. They are HttpOnly, so scripts cannot read them.",
      "We do not use any third-party analytics, crash reporting or advertising cookies or SDKs today, so the optional categories below only switch on our own first-party features. If we add a third-party tool, we will list it here, with provider, purpose and lifetime, before it runs.",
    ],
    table: {
      columns: ["Name", "Category", "Purpose", "Lifetime"],
      rows: [
        ["zd_at", "Essential", "Short-lived sign-in token for the web apps.", "15 minutes"],
        ["zd_rt", "Essential", "Keeps you signed in by renewing the sign-in token.", "30 days"],
        ["zd_sid", "Essential", "Identifies your signed-in session so you can sign out everywhere.", "30 days"],
        ["zd_viewer", "Essential", "Caches basic details of the signed-in account to load pages faster.", "5 minutes"],
        ["zd_reset", "Essential", "Protects a password reset in progress.", "Until the reset finishes"],
        ["theme", "Essential", "Remembers light or dark mode.", "Until you change it"],
        ["zudomart_consent", "Essential", "Legacy cookie name retained so returning visitors keep their saved cookie choice and policy version.", "180 days"],
        ["zudomart_consent_synced_at (local storage)", "Essential", "Legacy storage key retained to keep the saved consent choice in sync with your account.", "Until you clear site data"],
        ["Cloudflare Turnstile", "Essential", "Human check that protects sign-up, sign-in and sensitive actions. It does not use cookies to track you across sites.", "Per check"],
      ],
    },
  },
  {
    id: "apps",
    heading: "In our mobile apps",
    paragraphs: [
      "The apps store your sign-in tokens, chat encryption keys and payment tokens in your device's secure storage (Keychain on iOS, Keystore on Android). They use push notification services from Apple, Google and Expo. Optional analytics and advertising SDKs, if we add them, follow the same choices as on the web, which you can change in Settings, Privacy & Data. On iOS we ask permission before any tracking across other companies' apps. You can also reset or limit your advertising ID in your device settings.",
    ],
  },
  {
    id: "our-consent-cookie",
    heading: "How we record your choice",
    paragraphs: [
      "We store your choice in the zudomart_consent cookie, a legacy cookie name retained so returning visitors keep their saved choice, with the policy version you answered. If you are signed in, we also save the choice to your account so it applies on your other devices, and we keep a record of it to show we asked. If the policy version changes in a way that affects consent, we ask again.",
    ],
  },
  {
    id: "manage",
    heading: "How to manage your choices",
    paragraphs: [
      "Change your choice at any time with Cookie settings in the footer of our websites, or Settings, Privacy & Data in the app. You can also block or delete cookies in your browser, but parts of Nantty, such as staying signed in, will stop working. We honour the Global Privacy Control signal as an opt-out of advertising cookies.",
    ],
  },
  {
    id: "contact",
    heading: "Contact us",
    paragraphs: [`Questions about cookies: ${emailAddresses.privacy}.`],
  },
  {
    id: "updates",
    heading: "Updates to this policy",
    paragraphs: ["We post changes on this page and update the version and effective date."],
  },
  {
    id: "credits",
    heading: "About this document",
    paragraphs: [generalLegalCreditParagraph],
  },
];
