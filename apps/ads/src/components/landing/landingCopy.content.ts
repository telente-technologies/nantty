export interface CampaignStep {
  readonly title: string;
  readonly description: string;
}

export const campaignCreationSteps: readonly CampaignStep[] = [
  { title: "Pick an objective", description: "Reach, store visits, messages, followers, engagement or sales. The objective decides what delivery optimises for." },
  { title: "Choose your audience", description: "Locations down to the city, age, gender, interests and your own customers. The size estimate updates as you go." },
  { title: "Set budget and schedule", description: "A daily or lifetime budget in your local currency, start and end dates, and an automatic or capped bid." },
  { title: "Build your ads", description: "Promote a post, clip, product, store or live stream you already have, or upload new media. Preview it exactly as buyers see it." },
  { title: "Review and publish", description: "Check everything on one page. Every ad is reviewed against our policies before it runs, usually within a few hours." },
];

export interface FeatureShowcase {
  readonly id: string;
  readonly eyebrow: string;
  readonly heading: string;
  readonly lede: string;
  readonly points: readonly string[];
  readonly screenshot: string;
  readonly screenshotAlt: string;
}

export const featureShowcases: readonly FeatureShowcase[] = [
  {
    id: "targeting",
    eyebrow: "Targeting",
    heading: "Reach the buyers who already shop like yours.",
    lede: "Nigeria first, with Ghana, Kenya, South Africa, the UK and the US one search away.",
    points: [
      "Countries, states and cities, from all of Nigeria down to Yaba or Aba",
      "Age, gender, interests like fashion, sneakers or owambe, and shopping behaviours",
      "Your store customers, people who engaged with your posts, and your followers",
      "Customer lists hashed with SHA-256 in your browser, so raw emails and phone numbers never leave your device",
      "Lookalikes that find people similar to your best buyers",
    ],
    screenshot: "/screenshots/wizardAudience.webp",
    screenshotAlt: "Campaign creation audience step with locations, age range, interests and a live audience size estimate",
  },
  {
    id: "billing",
    eyebrow: "Budgets and billing",
    heading: "Pay in your local currency. Stop whenever you want.",
    lede: "Every amount is shown and charged in your ad account's own currency.",
    points: [
      "Top up a prepaid balance through a secure hosted checkout, or add a card",
      "Daily or lifetime budgets, campaign spend caps and a monthly account limit",
      "Gold Premium businesses get a monthly ad credit, spent before your balance",
      "Invoices and receipts for every payment, ready for your accountant",
    ],
    screenshot: "/screenshots/billing.webp",
    screenshotAlt: "Billing page with balance, monthly ad credit, payment settings and transactions",
  },
  {
    id: "reporting",
    eyebrow: "Reporting",
    heading: "See what sold, not just what was seen.",
    lede: "Orders in your Zudomart store are attributed to your ads automatically. No pixel to install.",
    points: [
      "Spend, reach, clicks, CTR, CPC, CPM, purchases, sales value and return on ad spend",
      "Break results down by campaign, ad set, ad, placement, day, state, age or gender",
      "Compare with the previous period and choose your click and view attribution windows",
      "Export any report as CSV, or have it emailed to your team every day, week or month",
    ],
    screenshot: "/screenshots/reportsPlacement.webp",
    screenshotAlt: "Reports page with a daily spend chart, results by placement and a breakdown table",
  },
];

export interface LandingQuestion {
  readonly question: string;
  readonly answer: string;
}

export const landingQuestions: readonly LandingQuestion[] = [
  { question: "Do I need a separate account for Ads Manager?", answer: "No. You sign in with the same email or phone and password you use in the Zudomart app. Your posts, clips, products, store and followers are already here." },
  { question: "What is the difference between boosting and Ads Manager?", answer: "Boosting in the app promotes one post with a simple budget. Ads Manager is for businesses and advanced advertisers: full campaigns, audiences, several ads, A/B tests, automated rules, billing and detailed reports." },
  { question: "Which currency will I pay in?", answer: "Your ad account's currency is set from its country when you create it, so you see budgets, bids, spend and invoices in your local currency." },
  { question: "How do I pay?", answer: "Top up a prepaid balance through Paystack's secure checkout by card, bank transfer or USSD, or add a card. Card details are handled by Paystack and never stored by Zudomart." },
  { question: "How long does ad review take?", answer: "Usually a few hours. If an ad is rejected you see the exact policy and reason. Edit it and it is reviewed again, or appeal the decision once." },
  { question: "How are sales counted?", answer: "When someone taps or watches your ad and then orders from your Zudomart store within your attribution window, the order is counted for that ad. Each order is counted once." },
  { question: "Can my team help run ads?", answer: "Yes. Invite people as admin, advertiser, analyst or billing manager. Each role only sees and changes what it needs." },
];
