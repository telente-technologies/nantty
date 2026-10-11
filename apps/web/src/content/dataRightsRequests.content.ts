import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const dataRightsRequestsSections: readonly LegalDocumentSection[] = [
  {
    id: "rights",
    heading: "Your rights",
    paragraphs: [
      "This page explains how to use the data rights described in our Privacy Policy: access, correction, deletion, restriction, objection, withdrawing consent, portability, and asking for a person to review an automated decision. Using your rights is free.",
    ],
  },
  {
    id: "how-to-ask",
    heading: "How to make a request",
    paragraphs: ["The fastest way is in the app, where we already know it is you:"],
    bullets: [
      "Download your data: Settings, Privacy & Data, Download your data.",
      "Delete your account: Settings, Privacy & Data, Delete account. You have 30 days to change your mind by logging in.",
      "Correct your data: edit your profile, addresses and settings directly.",
      "Change consent: cookie settings on our websites, and Settings, Privacy & Data in the app.",
      `Anything else: email ${emailAddresses.privacy} or our Data Protection Officer at ${emailAddresses.dpo}, or open a Help Centre ticket and choose Privacy.`,
    ],
  },
  {
    id: "verification",
    heading: "Checking it is you",
    paragraphs: [
      "If you are signed in, that is usually enough. If you write from outside the app, we may ask you to confirm from the email address on your account or answer questions about your account. We only ask for an ID document if there is no other way, and we delete it once your identity is confirmed. A parent or guardian can make requests for a child's account. Someone acting for you needs your signed permission.",
    ],
  },
  {
    id: "timelines",
    heading: "How long we take",
    paragraphs: [
      "We confirm we received your request within 72 hours [Team to confirm]. We answer as soon as we can and within the time your law sets:",
    ],
    table: {
      columns: ["Where you live", "Time to answer"],
      rows: [
        ["Nigeria", "Within 30 days, the period the NDPC expects under the GAID. [Team to confirm with counsel.]"],
        ["Kenya", "Access requests within 7 days; other requests within 14 days. [Team to confirm the 14-day period with counsel.]"],
        ["Ghana", "Within 21 days. [Team to confirm with counsel.]"],
        ["South Africa", "Within 30 days, as PAIA sets for access requests."],
        ["United Kingdom and European Union", "Within one month, extendable by two months for complex requests."],
        ["United States", "Within 45 days, extendable by 45 days where state law allows."],
      ],
    },
  },
  {
    id: "limits",
    heading: "When we cannot do everything you ask",
    paragraphs: [
      "Some data must be kept by law, for example order, payment and verification records for tax and anti-money laundering rules, or data needed for an open dispute, claim or investigation. We cannot show you other people's personal data, or chat messages, which are end-to-end encrypted and live on your devices. If we refuse all or part of a request, we tell you why and how to complain.",
    ],
  },
  {
    id: "complaints",
    heading: "If you are not happy",
    paragraphs: [
      "You can ask our DPO to look at it again, and you can complain to the Nigeria Data Protection Commission or the data protection authority where you live: the Data Protection Commission in Ghana, the Office of the Data Protection Commissioner in Kenya, the Information Regulator in South Africa, the Information Commissioner's Office in the UK, or the authority in your EU country.",
    ],
  },
  {
    id: "records",
    heading: "Our records",
    paragraphs: [
      "We keep a log of each request, what we did and when, to show regulators that we answer on time. The log is kept for 3 years after the request closes. [Team to confirm.]",
    ],
  },
];
