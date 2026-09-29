export interface PolicySection {
  readonly code: string;
  readonly title: string;
  readonly summary: string;
  readonly examples: readonly string[];
}

export const prohibitedCategories: readonly PolicySection[] = [
  { code: "illegal_products", title: "Illegal products and services", summary: "Anything illegal in the country where the ad is shown.", examples: ["Unlicensed drugs or pharmaceuticals", "Stolen goods", "Fake documents or certificates"] },
  { code: "weapons", title: "Weapons and explosives", summary: "Firearms, ammunition, explosives and parts for them.", examples: ["Guns and gun parts", "Fireworks sold without a licence"] },
  { code: "tobacco_vaping", title: "Tobacco, vaping and recreational drugs", summary: "Cigarettes, vapes, shisha and drug paraphernalia.", examples: ["E-cigarettes and refills", "Shisha flavours"] },
  { code: "adult_content", title: "Adult content and services", summary: "Nudity, sexual services and suggestive imagery.", examples: ["Escort services", "Sexually suggestive thumbnails"] },
  { code: "financial_scams", title: "Deceptive financial products", summary: "Get-rich-quick offers, ponzi schemes and unregistered investments.", examples: ["\"Double your money in 7 days\"", "Unregistered crypto investment pools", "Loan apps without a CBN licence"] },
  { code: "counterfeit", title: "Counterfeit goods", summary: "Replicas or fakes of branded products.", examples: ["\"First copy\" designer bags", "Fake phone accessories sold as original"] },
  { code: "misleading_claims", title: "Misleading claims", summary: "Before-and-after health claims, miracle cures, fake scarcity or fake reviews.", examples: ["\"Cures diabetes in 3 days\"", "Countdown timers that reset"] },
  { code: "gambling", title: "Gambling without authorisation", summary: "Betting, lotteries and casinos need written approval and a valid licence.", examples: ["Sports betting without a state licence"] },
  { code: "discrimination", title: "Discrimination and hate", summary: "Ads that target or exclude people by ethnicity, religion or other protected traits in a harmful way.", examples: ["Housing ads that exclude a tribe", "Slurs or hateful symbols"] },
  { code: "personal_attributes", title: "Personal attributes", summary: "Text that implies you know someone's health, finances, religion or other private traits.", examples: ["\"Are you HIV positive?\"", "\"Struggling with your debts, Chinedu?\""] },
];

export const restrictedCategories: readonly PolicySection[] = [
  { code: "alcohol", title: "Alcohol", summary: "Allowed only to people 18+ and only where local law permits.", examples: ["Beer, wine and spirits"] },
  { code: "health_supplements", title: "Health and weight-loss products", summary: "Allowed to people 18+ with NAFDAC registration where required and no unrealistic claims.", examples: ["Herbal supplements", "Weight-loss teas"] },
  { code: "political", title: "Political and social issues", summary: "Needs identity verification and a \"Paid for by\" disclaimer.", examples: ["Election campaigns", "Advocacy on public policy"] },
  { code: "financial_services", title: "Financial services", summary: "Lenders, investment and payment apps must show their licence.", examples: ["Microfinance loans", "Savings apps"] },
];

export const reviewStateDescriptions = [
  { state: "Draft", description: "Saved but not sent. Nothing is shown and nothing is charged." },
  { state: "In review", description: "Checked against these policies, usually within a few hours." },
  { state: "Active", description: "Approved and delivering while there is budget and balance." },
  { state: "Paused", description: "Stopped by you or an automated rule. Resume any time." },
  { state: "Rejected", description: "Not approved. The reason and policy are shown on the ad. Edit it or appeal once." },
  { state: "Completed", description: "Reached its end date or lifetime budget." },
];
