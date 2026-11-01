import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { PlaceholderLegalDocument } from "@/components/legal/legalDocument";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

export const metadata = createPublicPageMetadata({
  title: "Waitlist privacy notice",
  description: "How Nantty plans to handle waitlist information.",
  path: "/waitlist-privacy",
  noIndex: true,
});

const sections: readonly LegalDocumentSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are",
    paragraphs: [
      "Nantty is a pre-launch project. Nantty is responsible for waitlist information. For privacy questions or requests, contact privacy@nantty.com.",
    ],
  },
  {
    id: "why-we-use-it",
    heading: "Why we use it",
    paragraphs: [
      "We use your email address and selected interest to record and manage your waitlist request. If you choose the seller or business option, optional seller details help us understand onboarding needs and plan the seller beta. Joining does not guarantee beta access. You can separately opt in to occasional launch updates; declining those updates does not remove you from the waitlist. We do not sell this information or use it for unrelated marketing.",
    ],
  },
  {
    id: "what-we-collect",
    heading: "What we collect and where it is stored",
    paragraphs: [
      "For everyone, the form collects your email address, selected interest, waitlist-processing acknowledgement, optional launch-update preference, and submission/consent times. If you select seller or business, you may also provide your name, store/business name, phone or WhatsApp number, product category, current sales channels, approximate monthly sales in NGN, expected product count, founding-seller beta interest, and intended listing timeframe. Seller details are optional. The form does not ask for precise location, payment credentials, or bank details.",
      "Entries are written through Google Apps Script to a private Google Sheet with access restricted to the Nantty account. Google provides the spreadsheet and script services and processes information to provide them; Google may process data outside Nigeria under its published privacy and security terms. Older seller responses are archived separately and marked as historical in the main list; their old beta acknowledgement is not treated as consent to marketing updates. A legacy seller can re-submit the form to confirm current interest.",
    ],
  },
  {
    id: "retention-and-choices",
    heading: "Retention and your choices",
    paragraphs: [
      "We keep your current waitlist entry for up to 12 months after you submit it, then delete it. You can withdraw your waitlist-processing acknowledgement, unsubscribe from launch updates, or ask to access, correct, or delete your entry at any time by emailing privacy@nantty.com. We aim to respond within 30 days. If you withdraw or ask us to delete the entry, we will remove it unless we must retain limited information for a legal obligation. Each launch email will include a way to unsubscribe.",
    ],
  },
  {
    id: "keeping-the-list-safe",
    heading: "Keeping the list safe",
    paragraphs: [
      "Access to the Sheet is restricted to the Nantty account owner. The form validates entries, checks for duplicates, and uses a honeypot and request serialization to reduce automated or repeated submissions; these measures do not guarantee that abuse will be prevented. Please provide only information you are comfortable sharing and do not submit another person’s contact details. If you are under 18, ask a parent or guardian to review this notice and submit the form with you.",
    ],
  },
  {
    id: "updates",
    heading: "Updates to this notice",
    paragraphs: [
      "This is a draft notice for the pre-launch waitlist and may be updated before or during launch. We will update this page if the data use, service provider, contact route, or retention period changes materially.",
    ],
  },
];

export default function WaitlistPrivacyPage() {
  return (
    <PlaceholderLegalDocument
      title="Waitlist privacy notice"
      summary="How Nantty plans to handle information submitted through the pre-launch waitlist."
      versionLabel="1.0 (draft)"
      effectiveDateLabel="Not yet effective"
      sections={sections}
    />
  );
}
