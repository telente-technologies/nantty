import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const copyrightPolicySections: readonly LegalDocumentSection[] = [
  {
    id: "scope",
    heading: "What this policy covers",
    paragraphs: [
      "This policy explains how rights owners report content or listings on Zudomart that infringe copyright, trademarks or designs, or that are counterfeit; how the person who posted can respond; and what happens to repeat infringers. It follows Part VII of Nigeria's Copyright Act 2022 (sections 54 to 58), and the notice-and-takedown rules of other countries where we operate.",
    ],
  },
  {
    id: "notice",
    heading: "How to send a notice",
    paragraphs: [
      `Use Report copyright in the menu of the post, clip, sound, live or product (you need to be signed in), or email ${emailAddresses.copyright}. Section 54 of the Copyright Act 2022 says a notice must be in writing and include:`,
    ],
    bullets: [
      "your physical or electronic signature (typing your full legal name counts), as the owner or someone authorised to act for them;",
      "identification of each work you say is infringed;",
      "identification of the infringing content and where it is, such as the link, and the start and end times for video or audio;",
      "your contact details: name, email, phone number or address, and your company or label if you act for one;",
      "a declaration that you believe in good faith the use is not authorised by the owner, their agent or the law;",
      "a statement that the information is accurate and that you are the owner or authorised to act for them.",
    ],
  },
  {
    id: "what-happens",
    heading: "What happens after a notice",
    paragraphs: [
      "A person on our copyright team reviews every notice. Audio fingerprinting can help, but a person decides. If the notice is complete and valid, we promptly tell the person who posted the content, and we take down or disable access to it, and then tell the rights owner, as section 55 requires.",
      "If the claim is about audio, we may keep the video up with the sound muted, and stop the sound being reused. If the claim is about the video or a listing, it is taken down or disabled. Claims about lives are acted on straight away.",
      "We take steps to stop removed content being uploaded again, and remove re-uploads without further notice, as section 55(3) requires.",
    ],
  },
  {
    id: "counter-notice",
    heading: "Counter-notices",
    paragraphs: [
      "If you believe your content was removed by mistake or misidentification, or that your use is allowed, send a counter-notice from Settings, Account status, with your full contact details, the reasons, your signature and an email address we can share with the claimant.",
      "We forward it to the rights owner straight away. If they do not tell us, within 10 business days, that you are not authorised to make the content available or that they have started court action, we restore the content and remove any strike that came from that claim. (Section 55(2) allows restoring after 7 days; we wait a little longer so rights owners in other countries have time to respond.)",
      "Anyone unhappy with a decision under section 55 can refer it to the Nigerian Copyright Commission.",
    ],
  },
  {
    id: "repeat-infringers",
    heading: "Repeat infringers",
    paragraphs: [
      "Section 56 of the Copyright Act 2022 sets the procedure for accounts that receive repeated notices, and we follow it:",
    ],
    bullets: [
      "When an account receives repeated notices, we send a warning that another valid notice will lead to suspension, and ask the account owner to confirm they received it.",
      "You can challenge the warning within 10 days with a signed counter-notice explaining the mistake or misidentification, or why the use was not infringing. If it cannot be resolved within 10 days, it is referred to the Nigerian Copyright Commission.",
      "After a further valid notice, with no challenge pending, the account is suspended for at least one month.",
      "On top of that, every upheld claim about a video or listing adds a strike that lasts 12 months. Your first infringement gets a warning. A repeat infringement within 12 months suspends posting, going live, selling and earning for at least 30 days, in line with the one-month suspension in section 56 of the Copyright Act 2022. A third strike sends the account for review for permanent closure. Money already in your wallet stays yours.",
    ],
  },
  {
    id: "trademarks",
    heading: "Trademarks and counterfeits",
    paragraphs: [
      "Brand owners can report listings and content that use their trademark without permission or sell counterfeit goods, with proof of the trademark (for example a registration under the Trade Marks Act) and the items concerned. Verified brands can report from their brand profile. Counterfeit listings are removed, and sellers who repeatedly list counterfeits are closed.",
    ],
  },
  {
    id: "false-claims",
    heading: "False claims",
    paragraphs: [
      "Under section 57, anyone who knowingly makes a false notice or counter-notice can be liable for the harm it causes. We may stop accepting notices from people who misuse the process.",
    ],
  },
  {
    id: "other-countries",
    heading: "Other countries",
    paragraphs: [
      "For users in the United States, we follow the notice-and-takedown process of the Digital Millennium Copyright Act. [Team to replace: Zudomart's designated DMCA agent registered with the US Copyright Office.] For users in the EU, notices are handled under the Digital Services Act, and we give a statement of reasons for every removal.",
    ],
  },
];
