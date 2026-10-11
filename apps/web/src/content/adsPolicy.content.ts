import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const adsPolicySections: readonly LegalDocumentSection[] = [
  {
    id: "who-can-advertise",
    heading: "Who can advertise",
    paragraphs: [
      "Zudomart Ads is open only to verified users: at least Level 1 (identity and a payout account in your own name verified), and business verification for some categories. Advertisers must be 18 or over. You can pay for ads from your card or from your earnings wallet.",
      "This policy applies to sponsored ads bought in Zudomart Ads, to boosts, and to paid partnerships between creators and brands.",
    ],
  },
  {
    id: "labels",
    heading: "Boosted, Sponsored and Paid partnership",
    paragraphs: ["Paid reach is always labelled, so people know what they are seeing:"],
    bullets: [
      "Boosted: you paid to show your own post to more people. Premium members get 1 free boost a month.",
      "Sponsored: an ad bought in Zudomart Ads, shown in feeds, between clips, before or after videos, and in lives only if the creator turned live ads on.",
      "Paid partnership: a creator was paid or given something to post about a brand. The creator must turn on the label.",
    ],
  },
  {
    id: "arcon",
    heading: "Nigerian advertising law (ARCON)",
    paragraphs: [
      "Ads shown to people in Nigeria must follow the Advertising Regulatory Council of Nigeria Act 2022 and the Nigerian Code of Advertising Practice. ARCON requires advertising to be vetted and approved before it is exposed to the public, and it applies this to online ads, influencer posts and skits. The advertiser is responsible for getting that approval, and we may ask for the approval reference before or after an ad runs. [Team to confirm with counsel which Zudomart ad formats and boosts need ARCON pre-exposure approval, and whether Zudomart must register with ARCON as an advertising platform.]",
      "Ads must be legal, decent, honest and truthful. Claims must be backed by evidence. Prices must be the full price. Comparisons must be fair. Endorsements must reflect the endorser's genuine experience.",
      "Ads in other countries must follow their rules too, such as the UK CAP Code, the EU Digital Services Act and the US FTC Endorsement Guides.",
    ],
  },
  {
    id: "prohibited",
    heading: "Never allowed",
    paragraphs: ["Ads for these are always rejected:"],
    bullets: [
      "Anything on the prohibited items list in the Community Guidelines, and anything illegal where the ad is shown.",
      "Weapons, ammunition and explosives.",
      "Tobacco, vaping and recreational drugs. Tobacco advertising is banned in Nigeria by the National Tobacco Control Act 2015.",
      "Adult content and sexual services, and sexually suggestive images.",
      "Deceptive financial products: get-rich-quick offers, Ponzi schemes, unregistered investments and crypto schemes, and loan apps without the required licence.",
      "Counterfeit goods.",
      "Misleading claims: miracle cures, unrealistic before-and-after results, fake scarcity, countdown timers that reset, fake reviews.",
      "Discrimination and hate, and ads that exclude people by ethnicity, tribe, religion or other protected traits.",
      "Ads that imply knowledge of someone's private traits, such as health, finances or religion.",
      "Ads that copy Zudomart's interface to trick people, or that link to malware or phishing.",
    ],
  },
  {
    id: "restricted",
    heading: "Allowed with limits",
    paragraphs: ["These need extra documents, targeting limits or approvals:"],
    bullets: [
      "Alcohol: adults 18+ only, where local law allows, with responsible drinking messages.",
      "Health, weight-loss and supplements: adults only, NAFDAC approval where required (NAFDAC requires approval for adverts of regulated products), and no unrealistic claims.",
      "Financial services: lenders, investment, savings and payment apps must show their licence or registration (for example from the Central Bank of Nigeria, the Securities and Exchange Commission, or the FCCPC for digital lenders).",
      "Gambling, betting and lotteries: only with written approval from us and a valid licence for each state or country targeted, and adults only.",
      "Political and social issue ads: identity verification, a 'Paid for by' disclaimer, and compliance with the Electoral Act 2022 campaign periods. [Team to confirm whether political ads are allowed at launch.]",
      "Real estate, education and job ads: no discrimination, and no fake guarantees.",
    ],
  },
  {
    id: "targeting",
    heading: "Targeting and data",
    paragraphs: [
      "Ads are chosen by a system separate from feed ranking, with frequency caps. Personalised ads are shown only to adults who allowed them. Under-18s see only non-personalised ads, and never ads for restricted categories. You may not target ads using sensitive data such as health, religion, ethnicity or sexuality, or upload personal data you are not allowed to use.",
    ],
  },
  {
    id: "landing-pages",
    heading: "Destinations",
    paragraphs: [
      "Links must use https, work, and lead to what the ad promises. Product ads should link to a Zudomart product or store, so buyers in Nigeria are protected by escrow.",
    ],
  },
  {
    id: "review",
    heading: "Review, payment and enforcement",
    paragraphs: [
      "Every ad and boost is reviewed before it runs, usually within a few hours, and may be re-checked while it runs. If an ad is rejected, the reason is shown. You can edit and resubmit, or appeal once; a person reviews every appeal, usually within 24 hours.",
      "We may pause or remove ads that break this policy, and suspend advertisers who repeatedly do. Spend on ads removed for breaking this policy is not refunded unless the law requires it. Spend that was not delivered is returned to the funding source or wallet. Prices are per country, with a minimum cost per thousand impressions shown in Zudomart Ads.",
      `Ads questions: ${emailAddresses.ads}.`,
    ],
  },
];
