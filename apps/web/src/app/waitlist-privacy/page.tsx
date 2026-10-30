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
      "We use your email address to send occasional updates about Nantty’s beta and launch. Your selected interest helps us understand whether you are joining as a shopper, seller or business, or creator. Joining does not guarantee beta access. We do not use this information for unrelated marketing or sell it.",
    ],
  },
  {
    id: "what-we-collect",
    heading: "What we collect and where it is stored",
    paragraphs: [
      "The form collects your email address, selected interest, the fact and time of your consent, and the time of submission. It does not ask for your name, phone number, precise location, or payment information.",
      "The entry is written to a private Google Sheet using Google Apps Script. The Sheet is currently private to the Nantty Google account. Google provides the spreadsheet and script services and processes information to provide them; Google may process data outside Nigeria under its published privacy and security terms.",
    ],
  },
  {
    id: "retention-and-choices",
    heading: "Retention and your choices",
    paragraphs: [
      "We keep your waitlist entry for up to 12 months after you submit it, then delete it. You can withdraw consent or ask to access, correct, or delete your entry at any time by emailing privacy@nantty.com. We aim to respond within 30 days and remove the entry when you ask us to delete it. If we later send launch emails, each will include a way to unsubscribe.",
    ],
  },
  {
    id: "keeping-the-list-safe",
    heading: "Keeping the list safe",
    paragraphs: [
      "Access to the Sheet is restricted to the account owner. The form validates entries, checks for duplicates, and applies a daily submission limit. Please do not submit another person’s email address. If you are under 18, ask a parent or guardian to review and submit the form with you.",
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
