import type { LegalDocumentSection } from "@/components/legal/legalDocument";

export const privacyPolicyProcessingSections: readonly LegalDocumentSection[] = [
  {
    id: "purposes",
    heading: "Why we use your data, and our lawful basis",
    paragraphs: [
      "Section 25 of the NDPA, and Article 6 of the GDPR where it applies, require a lawful basis for each use. Where we rely on legitimate interests, we have weighed them against your rights and you can object. Where we rely on consent, you can withdraw it at any time in Settings, Privacy & Data or the cookie settings, without affecting what happened before.",
    ],
    table: {
      columns: ["Purpose", "Main data used", "Lawful basis"],
      rows: [
        ["Create and run your account, sign-in and settings", "Account, device", "Contract"],
        ["Process orders, escrow in Nigeria, wallets, payouts, refunds and disputes", "Account, addresses, payment and wallet, order activity", "Contract; legal obligation"],
        ["Verify identity and payout accounts, and check sanctions", "Verification, business, payment", "Legal obligation; legitimate interests (preventing fraud); explicit consent for biometrics"],
        ["Show feeds, search, trends and recommendations", "Content, activity, approximate location", "Legitimate interests (running a useful service); consent for optional personalisation cookies on the web"],
        ["Show and measure personalised ads", "Advertising data, activity", "Consent"],
        ["Show non-personalised ads, boosts and sponsored labels", "Country, language, the content on screen", "Legitimate interests"],
        ["Keep Zudomart safe: fraud, spam, abuse, security logs, live safety checks", "Device, network, activity, chat metadata, live frames and audio", "Legitimate interests; legal obligation"],
        ["Moderate content and handle reports, appeals and copyright claims", "Content, reports, chat messages you choose to report", "Legitimate interests; legal obligation"],
        ["Support and service messages", "Account, support data", "Contract; legitimate interests"],
        ["Marketing emails and push messages", "Account, preferences", "Consent"],
        ["Analytics and product improvement", "Device, activity", "Legitimate interests; consent for analytics cookies on the web"],
        ["Tax, accounting, anti-money laundering and responding to lawful requests", "Payment, verification, business", "Legal obligation"],
      ],
    },
  },
  {
    id: "automated-decisions",
    heading: "Automated decisions and profiling",
    paragraphs: [
      "We use automated systems to rank content, filter spam and fake engagement, score fraud and trust risk, sample live video for severe harm, and match verification results. Some of these are profiling.",
      "Automated systems can flag, limit or hold something for review, and can approve a verification when every check matches. They never permanently ban an account, reject a verification or decide a dispute on their own: a person does. Under section 37 of the NDPA, and Article 22 of the GDPR where it applies, you can ask for a person to review any decision about you that was made by automated means and that significantly affects you, give your view and contest it. You can see why a post was shown to you from its menu.",
    ],
  },
  {
    id: "sharing",
    heading: "Who we share data with",
    paragraphs: ["We do not sell your personal data. We share it only as needed with:"],
    bullets: [
      "Payment partner: Flutterwave, which holds Nigerian wallets in your name and processes payments and payouts. It acts partly as our processor and partly as a controller under its own licences and policies.",
      "Smile ID, for identity, document and liveness checks.",
      "Amazon Web Services, which hosts our systems and data (main region Ireland, backup region Germany), sends our emails (Amazon SES) and runs automated safety checks on live video and audio (Amazon Rekognition and Amazon Transcribe).",
      "LiveKit, which carries live video, and Cloudflare, which runs the Turnstile human check and receives technical signals from your browser to tell people from bots.",
      "Apple and Google, for in-app purchases and push notifications, and Expo for delivering push notifications to our apps.",
      "Sellers, who receive your name, delivery address and contact number to fulfil your order, and buyers, who see a seller's store and business details.",
      "Other users and the public, who see your public profile and content. Private profiles limit this.",
      "Analytics and advertising partners, only if you have allowed them. [Team to replace: the names of analytics, crash reporting and advertising measurement providers once chosen.]",
      "Professional advisers, auditors and insurers, and a buyer or investor in Zudomart under confidentiality if the business is sold or reorganised.",
      "Regulators, courts and law enforcement, such as the NDPC, the FCCPC, the Nigeria Police, the EFCC and the NFIU, when the law requires or to protect people from serious harm. We check that requests are lawful and share only what is needed.",
    ],
  },
  {
    id: "international-transfers",
    heading: "International transfers",
    paragraphs: [
      "Your data is stored mainly in the European Union (Ireland, with backups in Germany) and is also processed by our providers in the United States and other countries. Sections 41 to 43 of the NDPA allow these transfers where the receiving country or arrangement gives an adequate level of protection, or where another basis applies. We rely on: written contracts with each provider that impose NDPA-standard protections (and, for data from the UK or EU, the standard contractual clauses); the EU's own data protection law in Ireland and Germany; and, for a few transfers, the need to perform our contract with you (for example, paying a seller abroad).",
      "We keep a record of each transfer and its basis, as the NDPA and GAID require. You can ask for a copy of the safeguards from our DPO. [Team to confirm with counsel the transfer basis for each provider and whether the NDPC has recognised any adequacy decisions that apply.]",
    ],
  },
  {
    id: "retention",
    heading: "How long we keep data",
    paragraphs: ["We keep data only as long as needed for the purpose or as the law requires, then delete or anonymise it. Admins can shorten some periods but not below legal minimums."],
    table: {
      columns: ["Data", "How long"],
      rows: [
        ["Account, profile and content", "While your account is open. After you delete your account, 30 days to change your mind, then deleted."],
        ["Suspended accounts", "If a suspension stands, profile, posts, media and messages are deleted after 120 days."],
        ["Chat media", "Deleted automatically after 30 days. Message text stays on the devices in the chat."],
        ["Orders, payments, escrow, payouts and invoices", "At least 6 years after the transaction, then anonymised. [Team to confirm the period with counsel under the Companies and Allied Matters Act 2020, the Nigeria Tax Administration Act 2025 and the Money Laundering (Prevention and Prohibition) Act 2022.]"],
        ["Identity verification results and records", "While you are verified and at least 5 years after the business relationship ends, as anti-money laundering rules require. [Team to confirm.]"],
        ["Subscriber and traffic data", "2 years, as section 38 of the Cybercrimes (Prohibition, Prevention, etc.) Act 2015 requires of service providers."],
        ["Security logs", "Up to 12 months, or longer while a case or appeal is open."],
        ["Support tickets", "3 years after the ticket closes. [Team to confirm.]"],
        ["Marketing preferences and consent records", "While your account is open and 3 years after, to prove consent. [Team to confirm.]"],
        ["Usernames you give up", "Held for 120 days so nobody can take them over at once."],
      ],
    },
  },
  {
    id: "security",
    heading: "Security and breaches",
    paragraphs: [
      "We use technical and organisational measures that fit the risk, including encryption in transit and at rest, end-to-end encryption for chats, separate encrypted storage for verification data, least-privilege staff access with separation of duties, audit logs, and regular security testing. No system is perfectly secure.",
      "To protect accounts from unauthorised access and automated abuse, we keep security logs of refused requests (the type of page, counts, the time, a device identifier and a shortened network address, never the content you sent). Accounts that behave like automated software may be asked to complete a human check. Repeated failures can lead to a temporary suspension, which you can appeal.",
      "If a personal data breach is likely to put your rights at risk, we notify the NDPC within 72 hours of becoming aware of it, as section 40 of the NDPA requires, and tell you without undue delay in plain language if the risk is high, with steps you can take. We also report cyber incidents to the national CERT within 72 hours as the Cybercrimes (Amendment) Act 2024 requires.",
    ],
  },
  {
    id: "your-rights",
    heading: "Your rights",
    paragraphs: ["Under sections 34 to 38 of the NDPA, and similar laws where you live, you can:"],
    bullets: [
      "get confirmation that we process your data and a copy of it;",
      "have wrong or incomplete data corrected;",
      "have data deleted when we no longer need it, subject to what the law makes us keep;",
      "restrict processing while a complaint is checked;",
      "withdraw consent at any time;",
      "object to processing based on legitimate interests and to direct marketing;",
      "not be subject to a decision based only on automated processing that significantly affects you;",
      "receive your data in a common, machine-readable format, and ask us to send it to another provider (Settings, Privacy & Data, Download your data);",
      "complain to the NDPC or your local data protection authority.",
    ],
  },
  {
    id: "children",
    heading: "Children",
    paragraphs: [
      "Under the NDPA, a child is anyone under 18. If you are under 18, we need consent from your parent or guardian, and we take reasonable steps to check it. Under-18 accounts and anyone whose age we do not know never receive nudity or dangerous content, are not shown personalised ads, and cannot sell, receive payouts or run ads.",
      "If you believe a child has given us personal data without the right consent, contact our DPO and we will delete it. Reports about child safety go to an urgent queue, and we report child sexual abuse material to the authorities.",
    ],
  },
  {
    id: "marketing",
    heading: "Marketing",
    paragraphs: [
      "We send marketing emails and push messages only with your consent, and you can turn them off at any time in Settings or from the message. Personalised marketing from sellers and brands comes only from verified sellers and brands, and only if you agreed to it. Service messages, such as order updates and security alerts, are not marketing and you will still get them.",
    ],
  },
];
