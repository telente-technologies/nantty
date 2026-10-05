import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { contactMailtoHref, emailAddresses, siteConfig } from "@/lib/siteConfig.config";

export const termsOfServiceSections: readonly LegalDocumentSection[] = [
  {
    id: "agreement",
    heading: "Agreement to these terms",
    paragraphs: [
      "These terms apply when you use the Zudomart website, the Zudomart web app or the Zudomart mobile app. By using them you agree to these terms.",
      "[Team to replace: legal entity name and governing law.]",
    ],
  },
  {
    id: "accounts",
    heading: "Accounts",
    paragraphs: [
      "You must give accurate information, keep your login details safe, and be old enough to form a binding contract where you live. You are responsible for activity on your account.",
    ],
  },
  {
    id: "usernames",
    heading: "Usernames",
    paragraphs: [
      "When you sign up, Zudomart creates a username for you automatically. You can change it later in your account settings, but changes are limited: you can only change it a set number of times within a period, and your old username may stay unavailable for a while after you change it.",
      "Some usernames are reserved and cannot be chosen, including names of Zudomart products and teams, government bodies, well-known brands and public figures, and words that could mislead people about who they are dealing with.",
      "Your username does not belong to you. Zudomart may withhold, change or reclaim a username at any time, including when it impersonates a person, brand, store or government body, breaks our policies, infringes a trademark or other rights, or when we are required to for legal reasons. Where we can, we will tell you and give you a chance to choose a new one.",
      "[Team to replace: exact number of username changes allowed, the waiting period, and the reserved-name process for verified brands.]",
    ],
  },
  {
    id: "buying",
    heading: "Buying on Zudomart",
    paragraphs: [
      "Products are sold by independent sellers, not by Zudomart. Prices are shown in your local currency where supported, and otherwise in US dollars.",
      "When you pay, the money is held in escrow. It is released to the seller when you confirm delivery, or after a set period if you do not confirm or open a dispute.",
      "[Team to replace: automatic release period and dispute window.]",
    ],
  },
  {
    id: "selling",
    heading: "Selling on Zudomart",
    paragraphs: [
      "Sellers must be approved before listing. Sellers must describe products accurately, ship on time, and follow our prohibited items list and applicable law.",
      "Seller fees will be published before they apply. Payouts are made to a verified bank account after escrow is released.",
    ],
  },
  {
    id: "disputes",
    heading: "Disputes and refunds",
    paragraphs: [
      "If an order does not arrive or is not as described, open a dispute before confirming delivery. Zudomart will review the evidence from both sides and decide whether to refund the buyer or release payment to the seller.",
    ],
  },
  {
    id: "content",
    heading: "Your content",
    paragraphs: [
      "You keep ownership of the posts, clips, stories and live streams you create. You give Zudomart a licence to host and show them in the app so others can see and shop from them.",
      "Do not post content that is illegal, misleading, or infringes someone else's rights.",
    ],
  },
  {
    id: "ranking",
    heading: "How we rank content",
    paragraphs: [
      "Your feed, trends and suggestions are based on what is trending and what you engage with. Engagement that looks fake, such as bots, coordinated groups, engagement pods or bought likes, is discounted and cannot make a post or hashtag trend.",
      "Accounts with a checkmark get a small ranking boost with a fixed upper limit: up to 15% for Black, 12% for Gold, 10% for Premium, 8% for Blue Verified and 5% for Blue Essential. Official accounts that Zudomart created and verified show an Official label and get an extra editorial boost of up to 15%, never more than 25% in total. A post with much better engagement always outranks a boosted post with weak engagement.",
      "Nobody can pay for reach in the feed except through ads, which are always labelled. Zudomart staff cannot push posts or trends. They can only demote or remove content for policy reasons, and every change is logged. You can see why a post was shown to you from its menu, and the full details are in the help article \"How your feed works\".",
    ],
  },
  {
    id: "copyright",
    heading: "Copyright, trademarks and counterfeits",
    paragraphs: [
      "Only post content and list products you have the right to use and sell. Do not upload other people's photos, videos, music or designs without permission, and do not sell counterfeit or replica goods or use someone else's brand to sell your own.",
      `If you believe content or a listing on Zudomart infringes your copyright or trademark, or is counterfeit, report it from the post, clip, live or product in the app, or email ${emailAddresses.copyright} with a description of your work or brand, where the infringing item appears, and your contact details. Brand owners can also report through their verified brand profile.`,
      "We may remove or disable reported content and listings while we review them, and we will notify the person who posted them. If you think something was removed by mistake, you can ask us to review the decision.",
      "We operate a repeat infringer policy. Accounts and stores that repeatedly infringe copyright or trademarks, or repeatedly list counterfeit goods, will have features restricted, payouts held where the law allows, and may be permanently closed.",
      "[Team to replace: formal notice-and-takedown procedure, counter-notice process and the designated contact reviewed by counsel.]",
    ],
  },
  {
    id: "liability",
    heading: "Limits of liability",
    paragraphs: ["[Team to replace: limitation of liability and warranty disclaimers reviewed by counsel.]"],
  },
  {
    id: "contact",
    heading: "Contact",
    paragraphs: [`Questions about these terms can be sent to ${emailAddresses.legal}.`],
  },
];
