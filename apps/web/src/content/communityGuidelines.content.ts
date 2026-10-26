import type { LegalDocumentSection } from "@/components/legal/legalDocument";
import { emailAddresses } from "@/lib/siteConfig.config";

export const communityGuidelinesSections: readonly LegalDocumentSection[] = [
  {
    id: "introduction",
    heading: "Why we have these guidelines",
    paragraphs: [
      "Nantty is for discovering, watching, chatting, selling and buying. These guidelines apply to everything on Nantty: posts, clips, stories, lives, comments, usernames, profiles, product listings, ads, boosts and chats. They apply to everyone, including sellers, creators, brands and Nantty staff. Breaking the law in your country is always a breach.",
    ],
  },
  {
    id: "safety",
    heading: "Keep people safe",
    paragraphs: ["Not allowed:"],
    bullets: [
      "Any content that sexualises, grooms or endangers children. We have zero tolerance, we remove it immediately, ban the account and report it to the authorities.",
      "Threats, incitement to violence, glorifying violent attacks, and content that supports terrorist or violent extremist groups, including those proscribed under the Terrorism (Prevention and Prohibition) Act 2022.",
      "Harassment, bullying, doxxing (sharing someone's private details), and sharing intimate images without consent. We remove non-consensual intimate images within 24 hours of being told.",
      "Hate speech that attacks people for ethnicity, tribe, religion, nationality, sex, gender, disability, illness or other protected traits.",
      "Promoting suicide, self-harm or eating disorders. Content that helps people recover is allowed, and we show support resources.",
      "Dangerous challenges, and instructions for weapons, explosives or serious crime.",
      "Graphic violence or gore without a warning. Some newsworthy content is allowed behind a sensitive content warning.",
      "Nudity and sexual content. Adults can choose to see some sensitive content; under-18s never can.",
    ],
  },
  {
    id: "honesty",
    heading: "Be honest",
    paragraphs: ["Not allowed:"],
    bullets: [
      "Scams, phishing, advance-fee fraud and fake giveaways, including anything covered by the Advance Fee Fraud and Other Fraud Related Offences Act 2006.",
      "Impersonating a person, brand, store or government body, or using a username or profile that misleads people about who you are.",
      "Fake reviews, buying or selling followers, likes or views, engagement pods and coordinated fake activity, including fake ad impressions or clicks and gifting rings that cycle coins between accounts.",
      "Misleading AI-generated or edited media that is not labelled, especially of real people or events.",
      "False information that could cause real harm, such as fake health cures, election misinformation, or false emergency alerts.",
      "Pyramid schemes, Ponzi schemes and 'double your money' offers.",
      "Asking people to pay or chat outside Nantty to avoid escrow, fees or our safety checks.",
    ],
  },
  {
    id: "prohibited-items",
    heading: "Prohibited items",
    paragraphs: ["You may not list, sell, promote or arrange the sale of:"],
    bullets: [
      "Firearms, ammunition, gun parts, explosives, fireworks without a licence, and weapons designed to hurt people.",
      "Illegal drugs, drug paraphernalia, and controlled substances covered by the National Drug Law Enforcement Agency Act.",
      "Prescription-only medicines, unregistered drugs, injectables and medical devices without NAFDAC registration where required, and products with banned ingredients such as mercury or excessive hydroquinone in skin creams.",
      "Tobacco products, cigarettes, vapes, e-liquids and shisha.",
      "Counterfeit, replica or 'first copy' goods, and goods that infringe copyright, trademarks or designs.",
      "Stolen goods, and goods whose ownership you cannot prove.",
      "Fake or real identity documents, certificates, SIM cards that are already registered to someone, bank accounts, cards and account credentials, and personal data.",
      "Counterfeit money, and unlicensed financial products, loans, investments, crypto investment schemes and foreign exchange services.",
      "Gambling, betting and lottery services without a valid licence.",
      "Adult sexual services, pornography and sexual content.",
      "People, human organs, body parts and human remains, and anything that suggests trafficking or forced labour.",
      "Endangered wildlife and products from them, such as ivory and pangolin scales, and live animals except where we allow them with licences.",
      "Police, military, customs and other official uniforms and insignia.",
      "Hazardous chemicals, banned pesticides and recalled products.",
      "Antiquities and cultural objects that cannot be lawfully exported or sold.",
      "Exam questions, answers and academic cheating services.",
      "Hacking tools and services, malware, and services to get around security or verification.",
      "Goods on the Nigeria Customs Service import prohibition list, or goods banned in the buyer's country.",
    ],
  },
  {
    id: "restricted-items",
    heading: "Restricted items",
    paragraphs: [
      "These can be sold only by verified sellers who meet extra rules, and may be limited to adults or certain countries:",
    ],
    bullets: [
      "Alcohol: licensed sellers only, buyers 18 or over, where local law allows.",
      "Food, cosmetics, supplements and herbal products: NAFDAC registration number shown where required, and no medical claims.",
      "Electronics and electrical goods: must meet Standards Organisation of Nigeria requirements, and must not be sold as new if refurbished.",
      "Drones and other regulated equipment: only where the buyer may lawfully own them.",
      "Knives and tools that could be used as weapons: only for lawful household or work use, and not to under-18s.",
    ],
  },
  {
    id: "privacy-and-ip",
    heading: "Respect privacy and other people's work",
    paragraphs: [
      "Do not post other people's private information, record people in private settings without consent, or post someone else's photos, music or videos without permission. Copyright claims follow our Copyright and IP Policy.",
    ],
  },
  {
    id: "live",
    heading: "Live streams and gifts",
    paragraphs: [
      "Everything in these guidelines applies to lives. Do not pressure viewers, especially young people, to send gifts, do not promise anything in return for gifts that you will not deliver, and do not use lives to sell prohibited items. Gift rankings and leaderboards appear only inside lives.",
      "Do not trade coins or gifts for money, goods or services outside Nantty, run bets, raffles or lotteries with them, or use them to move money. Coins and gifts involved can be removed.",
      "Automated systems sample live video and audio (using Amazon Rekognition and Amazon Transcribe) to spot severe harm. They can blur, hide or pause a live and send it to a moderator, but they never ban an account on their own. The samples are deleted automatically after a day.",
    ],
  },
  {
    id: "chat-rules",
    heading: "Chats",
    paragraphs: [
      "Chats are end-to-end encrypted, so we do not read them, but these guidelines still apply. If someone breaks them in a chat, report the message or conversation: your device sends the messages you choose to our safety team, and the person you report is not told who reported them.",
    ],
  },
  {
    id: "enforcement",
    heading: "How we enforce: the enforcement ladder",
    paragraphs: [
      "We act in proportion to how serious the breach is, how often it has happened and whether it was intentional. We usually go step by step, but serious harm can go straight to the last step:",
    ],
    bullets: [
      "1. Content action: the content is removed, age-restricted, covered with a warning or shown to fewer people. You are told why.",
      "2. Warning: a formal notice that you broke a rule. A warning given after a report also counts as a strike. A warning recorded on its own stays on your Account status page for 6 months and does not count towards a restriction.",
      "3. Strike: active for 12 months, then it expires. Removing your content, warning you or suspending you after a report each adds one strike. Strikes add up across content, live, selling and copyright breaches. 3 active strikes pause earning money (gifts, tips, ads revenue share, subscriptions, Premium pool) and going live until a strike expires or is removed on appeal. Copyright strikes also follow the legal ladder in our Copyright and IP Policy: a second copyright strike within 12 months suspends posting, going live, selling and earning for at least 30 days, and a third sends the account for review.",
      "4. Feature restriction: for example no posting, live, selling, ads or earning for 1 to 30 days, or a lower sales limit.",
      "5. Temporary suspension: the account is hidden and cannot post, message, follow or sell for up to 30 days, and payouts may be held where the law allows while we investigate.",
      "6. Permanent ban: the account and its stores are closed and new accounts are not allowed. Money that belongs to you is not forfeited; it is paid out to your verified account, after any refunds you owe, unless the law requires us or our payment partner to hold it.",
      "Immediate ban and report to the authorities for: child sexual abuse material or grooming, credible threats to life, terrorism, human trafficking, and serious fraud.",
    ],
  },
  {
    id: "appeals",
    heading: "Appeals",
    paragraphs: [
      `You can appeal any action from the notice or from Settings, Account status. A different reviewer looks at it, and a person always decides: automated systems can flag or temporarily limit, but never ban on their own. If your appeal succeeds, the action and any strike are removed. Questions: ${emailAddresses.trustandsafety}.`,
    ],
  },
  {
    id: "reporting",
    heading: "Reporting",
    paragraphs: [
      "Report content, accounts, products, lives and chats from their menu. Urgent reports about child safety, self-harm or violence go to the front of the queue. Reports are confidential. If you see someone in immediate danger, contact local emergency services first.",
    ],
  },
];
