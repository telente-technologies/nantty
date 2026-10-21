# Zudomart legal pack

**Draft — not legal advice — review with a Nigerian lawyer before use.** Everything here is a working draft written on 2026-10-10 from public sources. Nothing is in effect until counsel approves it. The public policies keep `isReviewedByLegal: false` until then.

Parts are adapted from the CC0 templates by General Legal, PC (kept unchanged in `~/Desktop/legal-templates`). Their credit footnote is kept at the end of every derived document, as their README asks.

## 1. Public policies (website)

All are rendered by `apps/web/src/components/legal/legalPolicyPage.tsx` from content in `apps/web/src/content/` and registered in `legalPolicies.content.ts`. Zudomart has not launched, so every document is **version 1.0 (draft)**, planned effective date 2026-12-01 (to be confirmed with counsel), with no version history. The `/legal-archive/<slug>/<version>` route stays in place and has no entries until a post-launch version replaces 1.0. The Terms are split across `termsOfService.content.ts` and `termsOfServiceMoney.content.ts`.

| Page | Slug | Content file | Derived from General Legal |
| --- | --- | --- | --- |
| Terms of service | `/terms` | `termsOfService.content.ts`, `termsOfServiceMoney.content.ts` | Terms of Use |
| Privacy policy | `/privacy` | `privacyPolicy.content.ts`, `privacyPolicyProcessing.content.ts`, `privacyPolicyAnnexes.content.ts` | Privacy Policy (GDPR) and (US) |
| Cookie policy | `/cookies` | `cookiePolicy.content.ts` | Cookie Notice |
| Community guidelines | `/community-guidelines` | `communityGuidelines.content.ts` | no |
| Seller terms | `/seller-terms` | `sellerTerms.content.ts` | no |
| Creator Program terms | `/creator-terms` | `creatorTerms.content.ts` | no |
| Ads policy | `/ads-policy` | `adsPolicy.content.ts` | no |
| Refund and escrow policy | `/refund-escrow-policy` | `refundEscrowPolicy.content.ts` | no |
| Copyright and IP policy | `/copyright-policy` | `copyrightPolicy.content.ts` | no |
| Data rights requests | `/data-rights` | `dataRightsRequests.content.ts` | no |

The drafts were benchmarked against TikTok, Meta, Twitch, X and Kick and checked against the code in October 2026: see [platformBenchmark-2026-10.md](platformBenchmark-2026-10.md), including the code vs policy mismatches the owner must resolve.

Shared placeholders (entity name, credit line) live in `legalPlaceholders.content.ts`. Every remaining gap is marked `[Team to replace: ...]` or `[Team to confirm ...]`; search for `[Team to` to list them.

The same document keys are registered in: `apps/admin/src/constants/legalDocuments.constant.ts` (+ `types/legal.type.ts`, `apiContract.md`), `services/go/modules/users/src/modules/legal/services/legalDocuments.service.go`, `services/typescript/notifications/src/constants/policyDocuments.constant.ts`, and the `PolicyDocumentKey` types in webapp and mobile. Help Centre: `services/typescript/support/content/help/legal-and-data/terms-privacy-and-cookies.md`, the new `your-data-rights.md`, and a Nigeria repeat-notice section in `safety-and-reporting/copyright-and-account-status.md`.

## 2. Internal templates (`docs/legal/templates/`)

| Template | Use | Source |
| --- | --- | --- |
| [mutualNda.md](templates/mutualNda.md) | Two-way NDA for partners, investors, integrations | General Legal Mutual NDA |
| [oneWayNda.md](templates/oneWayNda.md) | Zudomart discloses only (candidates, agencies, vendors in evaluation) | General Legal One-Way NDA |
| [advisorAgreement.md](templates/advisorAgreement.md) | Advisors paid in share options under CAMA 2020 | General Legal Advisor Agreement |
| [masterServicesAgreement.md](templates/masterServicesAgreement.md) | B2B and brand deals, managed campaigns, integrations, with an Order Form | General Legal MSA |
| [dataProcessingAgreement.md](templates/dataProcessingAgreement.md) | Controller-to-processor DPA under NDPA s.29 with a UK/EU/US/GH/KE/ZA annex | General Legal DPA (Global and US) |
| [employeeOfferLetter.md](templates/employeeOfferLetter.md) | Nigerian employees: Labour Act, minimum wage, PAYE, pension, NHF, ECA, probation, notice | General Legal Offer Letter (rewritten) |
| [contractorAgreement.md](templates/contractorAgreement.md) | Freelancers and consultants, with IP assignment and WHT | IP and confidentiality clauses from General Legal |

**Not adapted: the HIPAA Business Associate Agreement.** HIPAA only governs US "covered entities" (health plans, providers, clearing houses) and their business associates handling protected health information. Zudomart is not a health provider and does not process PHI for one, so the BAA has no use. Health products sold on the marketplace are governed by NAFDAC rules, not HIPAA.

## 3. Compliance checklist by country

Status column is for the team to fill in.

### Nigeria (launch market)

| Obligation | Law | Detail | Status |
| --- | --- | --- | --- |
| Register with NDPC as a data controller of major importance | NDPA 2023 s.44; GAID 2025 Art. 7 | Tier (UHL/EHL/OHL) depends on data subjects processed; UHL and EHL register once, OHL renews yearly. Check the current NDPC fee schedule. | |
| Appoint a DPO and file their details | NDPA s.32; GAID | DPO must have expert knowledge; may be outsourced. Publish contact (`dpo@`). | |
| Annual Compliance Audit Return (CAR) | GAID 2025 | UHL/EHL file by **31 March** each year through a licensed DPCO; late filing adds 50% of the fee. First audit within 15 months of starting. | |
| DPIAs | NDPA s.28 | Needed at least for biometric verification (Smile ID), live-video safety scanning (Rekognition/Transcribe), fraud/trust scoring, ad targeting and children's data. | |
| Breach response plan | NDPA s.40; GAID | Notify NDPC within **72 hours**; tell data subjects without delay if high risk. | |
| Cyber incident reporting | Cybercrimes (Amendment) Act 2024 | Report to ngCERT via sectoral CERT within **72 hours**. | |
| Retain traffic and subscriber data | Cybercrimes Act 2015 s.38 | 2 years. | |
| Children's consent and age checks | NDPA s.31 | Under-18s need parent/guardian consent with appropriate verification. Product currently has no parental-consent flow (gap). | |
| Cross-border transfer records | NDPA ss.41–43 | Record basis per provider (AWS eu-west-1/eu-central-1, US vendors). | |
| Cookie banner | GAID | Prominent banner with accept and decline. Done in webKit; keep reject as easy as accept. | |
| Local presence and liaison officer | NITDA Code of Practice for Interactive Computer Service Platforms (2022) | Large platforms (over 100,000 Nigerian users) must be incorporated in Nigeria, publish a physical Nigerian address, appoint a liaison officer, and file an annual compliance report with NITDA. | |
| Takedown timelines | NITDA Code | Remove unlawful content on notice from an authorised agency (reported as 24 hours) and non-consensual intimate images within **24 hours**; keep a 24/7 channel for agencies. | |
| Copyright notice-and-takedown | Copyright Act 2022 ss.54–58 | Designate the notice channel; forward counter-notices; repeat infringer suspension of at least one month (s.56). | |
| ARCON | ARCON Act 2022; Nigerian Code of Advertising Practice | Ads and influencer content need pre-exposure vetting; check whether Zudomart must register as a platform/media and whether boosts count as ads. | |
| Consumer protection | FCCPA 2018 (incl. ss.120, 122, 127) | No blanket no-refund terms; plain-language terms; complaints to FCCPC. | |
| Payments licensing | CBN regulations; partner licences | Zudomart must never hold customer funds. Get written confirmation from counsel and Flutterwave that the PSA model needs no CBN licence for Zudomart. | |
| VAT and tax | Nigeria Tax Act 2025; Nigeria Tax Administration Act 2025 | Register for VAT and charge 7.5% on Zudomart fees unless small-company relief applies; check marketplace collection/reporting duties and e-invoicing. | |
| Employment | Labour Act; National Minimum Wage (Amendment) Act 2024 (₦70,000); Pension Reform Act 2014; NHF Act; Employee's Compensation Act 2010; ITF Act | Register with PFA/PenCom, NSITF, ITF, state tax authority (PAYE). | |
| Company records | CAMA 2020 | Keep accounting records at least 6 years; file annual returns. | |

### Ghana

| Obligation | Law | Detail | Status |
| --- | --- | --- | --- |
| Register with the Data Protection Commission | Data Protection Act 2012 (Act 843) | Certificate valid 2 years; apply to renew 3 months before expiry; appoint a Data Protection Supervisor. | |
| E-commerce consumer rules | Electronic Transactions Act 2008 (Act 772) | Disclosure and cooling-off rules for online sales (counsel to confirm exact sections). | |
| Cybersecurity | Cybersecurity Act 2020 (Act 1038) | Check whether any Cyber Security Authority licensing or child online protection duties apply. | |
| Payments | Bank of Ghana | No escrow and direct payment only until a licensed wallet partner exists. | |

### Kenya

| Obligation | Law | Detail | Status |
| --- | --- | --- | --- |
| Register with the ODPC | Data Protection Act 2019; Registration Regulations 2021 | Mandatory unless turnover under KES 5m and fewer than 10 staff; certificate valid 24 months. | |
| Access requests in 7 days; breach notice in 72 hours | General Regulations 2021; DPA s.43 | | |
| Consumer protection | Consumer Protection Act 2012 | Internet agreement disclosures and cancellation rights. | |
| Cybercrime | Computer Misuse and Cybercrimes Act 2018 (as amended) | Takedown cooperation. | |

### South Africa

| Obligation | Law | Detail | Status |
| --- | --- | --- | --- |
| Register the Information Officer | POPIA s.55 | On the Information Regulator eServices portal; a South African-based deputy is needed if the IO is abroad. | |
| PAIA manual | PAIA 2000 | Prepare and upload. | |
| Direct marketing opt-in | POPIA s.69 | Electronic marketing needs opt-in. | |
| E-commerce disclosures and cooling-off | ECTA 2002 ss.43–44 | 7-day cancellation after receipt of goods; refund within 30 days. | |
| Consumer protection | CPA 2008 | Defective goods return rights (6 months); unfair terms. | |

### UK and EU

| Obligation | Law | Detail | Status |
| --- | --- | --- | --- |
| Appoint EU and UK representatives | GDPR / UK GDPR Art. 27 | Required while Zudomart has no establishment there. | |
| SCCs / UK IDTA | GDPR Ch. V | For transfers to Nigeria and the US. | |
| Cookie consent | ePrivacy / PECR | Done in webKit. | |
| Online platform duties | EU Digital Services Act; UK Online Safety Act 2023 | Notice and action, statements of reasons, trader traceability, ad transparency, no profiling ads to minors, point of contact/legal representative; OSA risk assessments. | |
| Consumer rights | Consumer Rights Directive; UK CCRs 2013; UK DMCC Act 2024 | 14-day withdrawal (owed by traders); fake review ban; subscription rules. | |

### United States

| Obligation | Law | Detail | Status |
| --- | --- | --- | --- |
| DMCA designated agent | 17 U.S.C. §512 | Register with the US Copyright Office before relying on safe harbour. | |
| State privacy laws | CCPA/CPRA and others | Notice at collection, opt-out of sharing, honour GPC. | |
| Children | COPPA | Not directed at under-13s; block or get verifiable parental consent. | |
| Marketplace sellers | INFORM Consumers Act | Collect and verify high-volume third-party seller info. | |
| Endorsements and subscriptions | FTC Endorsement Guides; FTC rules on auto-renewals | Disclosures and easy cancellation. | |

## 4. Product gaps found while drafting

1. **Parental consent:** the policies say under-18s need a parent's consent (NDPA s.31), but sign-up has no parental-consent or age-assurance flow. Decide the minimum age and build it.
2. **Repeat infringers:** Copyright Act s.56 requires a warning with acknowledgment and, after a further notice, a suspension of at least one month. The moderation service uses 3 strikes in 90 days. The copyright policy describes both; the service should implement the s.56 path for Nigerian accounts.
3. **Takedown speed:** s.55 requires "expeditious" takedown. The product gives uploaders 48 hours to remove a video before automatic takedown. Counsel to confirm this is acceptable, or disable access immediately in Nigeria.
4. **Counter-notice wait:** the service waits 10 business days (Copyright Act allows restoring after 7 days). Lawful, but confirm.
5. **No personalised ads for under-18s** is promised in the policies; check the ad decision engine enforces it.
6. **Data-rights request log and 72-hour acknowledgment** are described in the Data rights page; the support service should track them.
7. **Direct payment in Nigeria** is mentioned for verified stores (existing help content). Confirm it still exists in the Flutterwave design.
8. **Code vs policy mismatches** found in the October 2026 benchmark are listed in `platformBenchmark-2026-10.md`. Two were resolved in code on 2026-10-19: undelivered escrows now move to staff review at payment + 30 days instead of auto-releasing, and post-payout refunds recover only the seller's portion while keeping Zudomart's fees. The remaining mismatches include no automatic strike pause, no CSAM reporting pipeline, web coin chargebacks not debited, the ad balance withdrawal fee and destination, Gold ad load, and the offer-link limit. Paystack is resolved: Flutterwave only.

## 5. Questions for a Nigerian lawyer

1. Does the Flutterwave payout-subaccount model (wallets in each user's name, Zudomart only instructing transfers and taking fees, escrow as a ledger lock) keep Zudomart outside CBN licensing (PSSP, switching, mobile money, or escrow regulation)? Do we need any CBN or NIBSS approval for the escrow wording?
2. Which NDPC tier will Zudomart fall into at launch, what are the current registration and CAR fees, and must the DPO be in Nigeria?
3. Is our biometric verification flow (explicit consent, no face template stored, Smile ID as processor) compliant with NDPA s.30 and the GAID? Do we need a DPIA filed with the NDPC?
4. What minimum age should we set, and what parental consent and age-verification method satisfies NDPA s.31?
5. Are the transfer bases for AWS in Ireland and Germany and US vendors adequate under NDPA ss.41–43 and the GAID, and has the NDPC issued any adequacy list we can rely on?
6. Does the NITDA Code of Practice bind us as a "Large Service Platform" from launch, and what local incorporation, address and liaison officer steps are needed? Is the Code's legal status settled?
7. Do boosts, in-app sponsored posts and creator paid partnerships each need ARCON pre-exposure approval, who must obtain it, and must Zudomart register with ARCON?
8. Is the arbitration clause (AMA 2023, Lagos seat, sole arbitrator) enforceable against Nigerian consumers, which institution and rules should we name, and should US users get an opt-out and class-action waiver?
9. Is the liability cap (greater of 12 months' fees and ₦100,000) acceptable under FCCPA s.127 and the Lagos courts' approach to unfair terms?
10. What are our VAT, withholding and reporting obligations as a marketplace under the Nigeria Tax Act 2025 and the Nigeria Tax Administration Act 2025, including e-invoicing and any duty to collect VAT on sellers' sales?
11. Exact retention periods for order, payment and KYC records (CAMA 2020, NTAA 2025, MLPPA 2022), and does the 2-year Cybercrimes Act s.38 retention apply to us?
12. Does our copyright process (48-hour uploader window, typed declaration instead of a "declaration on oath", 10 business days before restoring) meet ss.54–56 of the Copyright Act 2022?
13. Are coins and gifts (non-withdrawable, creator-convertible) likely to be treated as e-money or a regulated product by the CBN or SEC? Same question for ad balance (withdrawable) versus ad credit (never withdrawable).
14. Ghana, Kenya and South Africa: confirm registration duties at launch and whether "direct payment at your own risk" with seller verification is acceptable to consumer regulators there.
15. Is it fair under FCCPA ss.120–122 and 127 to keep the escrow and processing fees when a buyer is refunded after the seller was paid, refunding only the seller's portion?

## 6. Sources

Primary texts where available; secondary summaries noted.

- Nigeria Data Protection Act 2023 – NDPC: https://ndpc.gov.ng
- NDPC General Application and Implementation Directive 2025 – summaries: https://www.mondaq.com/nigeria/privacy-protection/1606106/ ; https://privacymatters.dlapiper.com/2025/06/nigeria-ndpc-issues-gaid-key-compliance-insights/ ; CAR 2026 obligations: https://webiis10.mondaq.com/nigeria/data-protection/1736914/
- Copyright Act 2022 (gazetted text, ss.28, 54–58): https://placng.org/i/wp-content/uploads/2023/04/Copyright-Act-2022.pdf ; Nigerian Copyright Commission: https://www.copyright.gov.ng
- NITDA Code of Practice for Interactive Computer Service Platforms – summaries: https://www.mondaq.com/article/1439396 ; https://www.afriwise.com/blog/exploring-the-nitda-code-of-practice-and-its-potential-impact-on-social-media-and-online-platforms
- Cybercrimes (Amendment) Act 2024, 72-hour reporting: https://aluko-oyebode.com/insights/cybersecurity-incident-reporting-nigeria-2025/ ; https://templars-law.com/app/uploads/2024/08/Cybercrimes.pdf
- FCCPA 2018, no-refund policies and ss.120, 122, 127: https://www.templars-law.com/app/uploads/2025/06/The-Legality-of-No-Refund-Policies-Under-Nigerian-Consumer-Protection-Law_v3.pdf ; https://dubawa.org/no-refund-policy-can-nigerians-return-defective-products-for-reimbursement/
- ARCON pre-exposure approval for online and influencer ads: https://www.mondaq.com/nigeria/social-media/1601550/influencer-and-digital-marketing-regulation-in-nigeria ; https://techpoint.africa/news/arcon-on-skit-makers-adverts
- Arbitration and Mediation Act 2023: https://www.templars-law.com/app/uploads/2023/07/Nigerian-Arbitration-and-Mediation-Act-202338.pdf ; https://ibanet.org/the-nigerian-arbitration-and-mediation-act-2023
- Nigeria Tax Act 2025 (VAT, digital services, PAYE bands): https://kpmg.com/us/en/taxnewsflash/news/2026/06/nigeria-tax-act-2025-reforms.html ; https://www.mondaq.com/nigeria/tax-authorities/1755664/ ; https://www.dlapiperafrica.com/en/nigeria/insights/2026/FAQs-on-payroll-taxes-and-employer-liability
- National Minimum Wage (Amendment) Act 2024: https://placng.org/i/wp-content/uploads/2024/07/National-Minimum-Wage-Amendment-Bill-2024.pdf ; https://mondaq.com/nigeria/employee-benefits-compensation/1510034/
- Labour Act (Cap L1 LFN 2004), Pension Reform Act 2014, NHF Act, Employee's Compensation Act 2010: texts at https://placng.org (counsel to confirm current rates)
- Ghana Data Protection Commission (registration, renewal): https://dataprotection.org.gh/registration/ ; https://dataprotection.org.gh/accreditation/
- Kenya ODPC registration guidance: https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-on-Registration-of-Data-Controllers-and-Data-Processors.pdf ; access requests in 7 days: https://bowmanslaw.com/insights/kenya-data-subject-access-requests-grey-areas-for-compliance/ ; Consumer Protection Act: https://www.sheriaplex.com/kenya-acts/the-consumer-protection-act-cap-501
- South Africa: ECTA s.44 cooling-off: https://www.acts.co.za/electronic-communications-and-transactions-act-2002/44__cooling_off_period ; Information Regulator eServices: https://eservices.inforegulator.org.za ; Information Officer guidance: https://www.michalsons.com/blog/information-officer/12231
- EU SCCs (Decision 2021/914), UK IDTA, GDPR: https://eur-lex.europa.eu ; https://ico.org.uk
- General Legal templates (CC0): https://general.legal
