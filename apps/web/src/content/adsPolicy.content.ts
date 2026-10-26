import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const adsPolicySections: readonly LegalDocumentSection[] = [
  {
    id: "who-can-advertise",
    heading: "Who can advertise",
    paragraphs: [
      "Nantty Ads is open only to verified users: at least Level 1 (identity and a payout account in your own name verified), and business verification for some categories. Advertisers must be 18 or over. You can pay for ads from your ad balance, your ad credit, your card or your earnings wallet.",
      "This policy applies to sponsored ads bought in Nantty Ads, to boosts, and to paid partnerships between creators and brands.",
    ],
  },
  {
    id: "labels",
    heading: "Boosted, Sponsored and Paid partnership",
    paragraphs: ["Paid reach is always labelled, so people know what they are seeing:"],
    bullets: [
      "Boosted: you paid to show your own post, profile or store to more people. Premium members get 1 free boost a month. Store and profile ads can also be bought in Nantty Ads.",
      "Sponsored: an ad bought in Nantty Ads, shown in feeds, between clips, before or after videos, and in lives only if the creator turned live ads on.",
      "Promoted: an ad shown between replies in a comment section.",
      "Paid partnership: a creator was paid or given something to post about a brand, or earns affiliate commission on it. The creator must turn on the label.",
    ],
  },
  {
    id: "ad-balance-and-credit",
    heading: "Ad balance and ad credit",
    paragraphs: ["Nantty Ads keeps two kinds of funds apart:"],
    bullets: [
      "Ad balance is real money you top up to pay for ads. Unspent ad balance can be withdrawn after a 24-hour hold from the top-up, once you are payout-verified. It goes to your Nantty wallet and from there to your verified payout account. Any fee is shown before you confirm.",
      "Ad credit is promotional value. It can be used only for ads and boosts in Nantty, is never money, and can never be withdrawn, transferred or exchanged for cash. Credit Nantty gives you, for example in a promotion or as goodwill, may expire on a date shown when we give it. Credit you earn in the app, such as cashback, never expires.",
      "Cashback: selected advertisers, chosen by Nantty, receive 10% of their delivered ad spend back as ad credit. We tell you if your account is selected, and we may change or end the offer with notice for future spend.",
    ],
  },
  {
    id: "ad-load",
    heading: "How many ads people see",
    paragraphs: ["The number of ads depends on the viewer's plan. Guests and under-18s are not shown ads. Today, compared with an account with no plan:"],
    bullets: [
      "No ads: Premium, the Business seller plan and the combined Gold and Premium plan.",
      "About 20% of the usual ads: government accounts with a Black checkmark.",
      "About half: a Gold checkmark on its own, and the Pro seller plan.",
      "About 60%: Blue Verified. About 75%: Blue Essential.",
      "If you have more than one plan, the lowest applies.",
    ],
  },
  {
    id: "arcon",
    heading: "Nigerian advertising law (ARCON)",
    paragraphs: [
      "Ads shown to people in Nigeria must follow the Advertising Regulatory Council of Nigeria Act 2022 and the Nigerian Code of Advertising Practice. ARCON requires advertising to be vetted and approved before it is exposed to the public, and it applies this to online ads, influencer posts and skits. The advertiser is responsible for getting that approval, and we may ask for the approval reference before or after an ad runs.",
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
      "Ads that copy Nantty's interface to trick people, or that link to malware or phishing.",
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
      "Political and social issue ads: identity verification, a 'Paid for by' disclaimer, and compliance with the Electoral Act 2022 campaign periods.",
      "Real estate, education and job ads: no discrimination, and no fake guarantees.",
    ],
  },
  {
    id: "targeting",
    heading: "Targeting and data",
    paragraphs: [
      "Ads are chosen by a system separate from feed ranking, with frequency caps. Personalised ads are shown only to adults who allowed them. Under-18s and guests are not shown ads. You may not target ads using sensitive data such as health, religion, ethnicity or sexuality.",
      "If you upload a customer list, upload only people who agreed to hear from you. Emails and phone numbers are hashed and matched inside Nantty; we never give you personal data about the people who see your ads, only aggregated results. Lookalike audiences are built inside Nantty in the same way.",
      "Advertisers are not charged for invalid traffic, such as fake or automated impressions and clicks. Creators who show your ads are paid a share of what you pay, as the Creator Program Terms explain.",
    ],
  },
  {
    id: "landing-pages",
    heading: "Destinations",
    paragraphs: [
      "Links must use https, work, and lead to what the ad promises. Product ads should link to a Nantty product or store, so buyers in Nigeria are protected by escrow.",
    ],
  },
  {
    id: "review",
    heading: "Review, payment and enforcement",
    paragraphs: [
      "Every ad and boost is reviewed before it runs, usually within a few hours, and may be re-checked while it runs. If an ad is rejected, the reason is shown. You can edit and resubmit, or appeal once; a person reviews every appeal, usually within 24 hours.",
      "We may pause or remove ads that break this policy, and suspend advertisers who repeatedly do. Spend on ads removed for breaking this policy is not refunded unless the law requires it. Spend that was not delivered is returned to the funding source or wallet. Prices are per country, with a minimum cost per thousand impressions shown in Nantty Ads.",
      `Ads questions: ${emailAddresses.ads}.`,
    ],
  },
];
