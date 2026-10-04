import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const cookiePolicySections: readonly LegalDocumentSection[] = [
  {
    id: "what-are-cookies",
    heading: "What cookies are",
    paragraphs: ["Cookies are small files stored on your device. We also use similar technologies such as local storage and SDKs in our apps. This policy explains the categories we use and how to control them. It sits alongside our Privacy Policy."],
  },
  {
    id: "categories",
    heading: "Categories we use",
    paragraphs: ["Optional categories stay off until you allow them. Optional scripts are not loaded before you choose."],
    table: {
      columns: ["Category", "Purpose", "Your choice"],
      rows: [
        ["Essential", "Keep you signed in, protect your account and our systems from abuse, and remember your cookie choice.", "Always on. Cannot be turned off because the service needs them."],
        ["Analytics", "Understand how features are used and how the product performs so we can fix problems and improve it.", "Off until you allow it."],
        ["Personalization", "Remember preferences and tailor what you see, such as suggestions.", "Off until you allow it."],
        ["Advertising", "Measure ads and show ads that are more relevant to you.", "Off until you allow it."],
      ],
    },
  },
  {
    id: "our-consent-cookie",
    heading: "The cookie that stores your choice",
    paragraphs: [
      "We store your choice in a first-party cookie named zudomart_consent, together with the policy version you responded to. If you are signed in, we also record your choice against your account so it applies on your other devices. If the policy version changes in a way that affects consent, we ask again.",
      "[Team to replace: the full list of cookies and SDKs in use, with provider, purpose and lifetime, once analytics and advertising tools are chosen.]",
    ],
  },
  {
    id: "manage",
    heading: "How to manage your choices",
    paragraphs: ["You can change your choice at any time using Cookie settings in the footer of our websites, or Settings, Privacy & Data in the app. You can also block or delete cookies in your browser settings, but parts of Zudomart may stop working."],
  },
  {
    id: "contact",
    heading: "Contact us",
    paragraphs: [`Questions about cookies: ${emailAddresses.privacy}.`],
  },
  {
    id: "updates",
    heading: "Updates to this policy",
    paragraphs: ["We will post changes on this page and update the version and effective date."],
  },
];
