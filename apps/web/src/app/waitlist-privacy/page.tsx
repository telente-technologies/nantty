import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Waitlist privacy notice — Nantty",
  description: "How Nantty plans to handle waitlist information.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://nantty.com/waitlist-privacy/" },
};

export default function WaitlistPrivacyPage() {
  return <article style={{ maxWidth: 760, margin: "64px auto", padding: "24px", lineHeight: 1.7 }}>
    <p><Link href="/">← Nantty home</Link></p>
    <h1>Waitlist privacy notice</h1>
    <p><strong>Draft — waitlist collection is disabled until this notice is completed and approved.</strong></p>
    <p>When enabled, Nantty will collect the email address, selected interest (shopper, seller/business or creator), consent, and submission time that you provide. The information will be sent directly to a restricted Google Sheet owned by Nantty using a Google Apps Script endpoint. Nantty does not currently operate a waitlist database.</p>
    <h2>Why we use it</h2>
    <p>To manage launch updates and understand which parts of Nantty people are interested in. We will not use waitlist signup as a promise of beta access.</p>
    <h2>Access, retention and your choices</h2>
    <p>Before signup opens, Nantty must publish the responsible legal entity and contact, retention period, deletion process, opt-out instructions, and the people or service providers who can access the Sheet. Until those details are confirmed, the form remains disabled and no waitlist information should be collected.</p>
    <h2>Contact</h2>
    <p>The contact address and final privacy terms will be published here before the form is enabled.</p>
  </article>;
}
