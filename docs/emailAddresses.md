# Zudomart email addresses

Owner decision, 2026-10-04: every Zudomart address is on the company domain. This replaces the earlier rule that the product only showed the owner's iCloud addresses.

- **Human mailboxes** live on the root domain: `<name>@zudomart.com`.
- **Automated mail** is sent through Amazon SES from the sending subdomain `mail.zudomart.com`, so its reputation is kept apart from the people's mailboxes.
- Nothing in the product hardcodes an address. Each app builds them from its brand config (`NEXT_PUBLIC_MAIL_DOMAIN`, `EXPO_PUBLIC_MAIL_DOMAIN`, `ZUDOMART_MAIL_DOMAIN`, `ZUDOMART_MAIL_SENDING_DOMAIN`), defaulting to the addresses below. The shared helper is `buildZudomartEmailAddresses` in `packages/webKit/src/contact/zudomartEmailAddresses.ts`; email senders are chosen by `selectEmailSender` in `packages/emailTemplates/src/config/emailSenders.config.ts`.

**Forwarding to the owner.** Until there is a team, the owner's iCloud addresses (oyinlola.tech@icloud.com and oluwayemioyinlola2@icloud.com) can be set as forwarding targets for any mailbox or group below. Configure this in the mail provider only; never put those addresses back in product code, emails or legal pages.

## Human addresses (root domain)

Type: **mailbox** is a real inbox with its own login; **alias** delivers into another mailbox; **group** is a shared inbox or distribution list with several members (Google Groups collaborative inbox or a helpdesk).

| Address | Type | Purpose | Who reads it | Where it is used |
| --- | --- | --- | --- | --- |
| support@zudomart.com | group (helpdesk) | Buyer and account help: orders, payments, escrow, disputes, sign-in | Support team | Web contact page, footers, help centre "Contact support", email footer, Reply-To of most transactional mail, API `SUPPORT_NOTIFICATION_EMAILS`, mobile Settings › Support, webapp |
| help@zudomart.com | alias → support@ | Catches people who guess "help@" | Support team | Not shown in the product |
| billing@zudomart.com | group | Receipts, invoices, subscriptions, VAT, card checks, ad billing | Finance and support | Reply-To of payments and receipt emails, Ads billing pages |
| payouts@zudomart.com | group | Seller and creator payouts, bank details, failed transfers | Finance | Reserved for payout pages and payout email copy (not shown yet) |
| sellers@zudomart.com | group | Store applications, business verification, listings, fees | Seller success | Seller dashboard landing, login and footer, web contact page, Reply-To of seller emails |
| creators@zudomart.com | group | Creator Program applications, earnings, Studio | Creator team | Studio landing, FAQ, login and footer, Reply-To of creator emails |
| ads@zudomart.com | group | Advertisers, campaigns, ad policy questions | Ads team | Ads landing, login, policy page, not-found page, footer |
| legal@zudomart.com | mailbox | Legal notices, terms questions, law-enforcement requests | Legal / owner | Terms of service, admin legal documents |
| privacy@zudomart.com | group | Data-subject requests (access, deletion, export), cookies | Privacy team, DPO | Privacy and cookie policies, web contact page, mobile data export, Reply-To of privacy and legal emails |
| dpo@zudomart.com | mailbox (or alias → privacy@ until a named DPO) | Data Protection Officer under the Nigeria Data Protection Act 2023; regulators (NDPC) and data subjects | Appointed DPO | Privacy policy |
| security@zudomart.com | group | Vulnerability reports; admin VPN / IP allow-list access problems | Engineering on call | `/.well-known/security.txt` on zudomart.com, README, admin sign-in and restricted pages, web contact page |
| abuse@zudomart.com | group | Spam, phishing, fraud and platform abuse reports from outside (also what other providers mail about our IPs) | Trust & Safety | Reported via WHOIS/abuse contacts; not shown in the app |
| copyright@zudomart.com | group | DMCA-style copyright and trademark notices and counter-notices | Trust & Safety (IP) | Terms of service (infringement section), help centre, Reply-To of copyright claim emails |
| trustandsafety@zudomart.com | group | Appeals and questions about strikes, restrictions and suspensions | Trust & Safety | Reply-To of trust and account-status emails |
| verification@zudomart.com | group | Checkmark and identity verification questions | Verification team | Reply-To of checkmark and verification emails |
| partnerships@zudomart.com | group | Brands, logistics and payment partners | Business development | README |
| press@zudomart.com | group | Journalists and media kits | Comms | Web contact page, README |
| careers@zudomart.com | group | Job applications | Hiring | Careers page when it ships |
| hello@zudomart.com | group | General enquiries; Reply-To of marketing emails | Owner / ops | Web contact page "anything else", README, Reply-To of marketing |
| dmarc@zudomart.com | mailbox (or a DMARC reporting service address) | Aggregate DMARC reports (`rua`) | Engineering | DNS only (`infra/aws/envs/*/terraform.tfvars`) |

## Automated senders (sending subdomain)

These addresses only send. Mail to them must not be read by people; replies go to the Reply-To shown below.

| Address | Sends | Reply-To | Notes |
| --- | --- | --- | --- |
| noreply@mail.zudomart.com | Auth and security codes, orders, escrow, seller, creator, checkmarks, trust, privacy/legal notices, support updates | support@ (seller → sellers@, creator → creators@, checkmarks → verification@, trust → trustandsafety@, copyright → copyright@, privacy/legal → privacy@) | Default `SES_FROM_ADDRESS` fallback |
| receipts@mail.zudomart.com | Payment receipts, coin receipts, subscription receipts, refunds, failed payments | billing@ | Display name "Zudomart Receipts" |
| notifications@mail.zudomart.com | Social notifications, milestones, digests and marketing | support@ (marketing → hello@) | Marketing carries `List-Unsubscribe` and one-click unsubscribe |
| alerts@mail.zudomart.com | Internal only: ops alarms, support-queue and moderation alerts to staff | not set | Never sent to customers |
| bounce.mail.zudomart.com (MAIL FROM / Return-Path) | Not an address you type: SES uses `<id>@bounce.mail.zudomart.com` as the envelope sender | — | Bounces and complaints come back through SES → SNS → SQS (`notifications-ses-feedback`) and are written to the suppression list automatically. Nobody reads a bounce mailbox |

### Reply-to policy

1. Automated mail never comes from a human address and never asks people to reply to `noreply@`.
2. Every automated message sets Reply-To to the team that can act on it (table above), so a reply always reaches a person.
3. Support replies (ticket updates) are sent from `noreply@mail.zudomart.com` with Reply-To `support@zudomart.com`; the helpdesk threads replies by the ticket reference in the subject.
4. Security emails (codes, new sign-ins, password changes) reply to support@ and always say we will never ask for a password, PIN or code.
5. Staff use their own `firstname@zudomart.com` mailbox only for one-to-one conversations, never for bulk or automated mail.

## DNS setup

Prod values; the Terraform module `infra/aws/modules/ses` creates the SES records for `mail_domain` (prod: `mail.zudomart.com`).

| Record | Name | Value | Notes |
| --- | --- | --- | --- |
| MX | `zudomart.com` | your mailbox provider (Google Workspace or Microsoft 365) | Human mail on the root |
| SPF (TXT) | `zudomart.com` | `v=spf1 include:_spf.google.com ~all` (or the provider's include) | Root domain: mailbox provider only. Keep under 10 lookups |
| SPF (TXT) | `bounce.mail.zudomart.com` | `v=spf1 include:amazonses.com ~all` | Custom MAIL FROM for SES (Terraform) |
| MX | `bounce.mail.zudomart.com` | `10 feedback-smtp.eu-west-1.amazonses.com` | Custom MAIL FROM (Terraform) |
| DKIM (3 × CNAME) | `<token>._domainkey.mail.zudomart.com` | `<token>.dkim.amazonses.com` | SES Easy DKIM, 2048-bit (Terraform) |
| DKIM | `google._domainkey.zudomart.com` | provider key | Sign human mail too |
| DMARC (TXT) | `_dmarc.zudomart.com` | `v=DMARC1; p=none; rua=mailto:dmarc@zudomart.com; adkim=r; aspf=r; fo=1` | Organisational policy; covers subdomains unless they have their own |
| DMARC (TXT) | `_dmarc.mail.zudomart.com` | same, from Terraform `dmarc_policy` | Starts at `p=none` |
| BIMI (TXT, optional) | `default._bimi.zudomart.com` | `v=BIMI1; l=https://zudomart.com/bimi/logo.svg; a=<VMC or CMC .pem>` | Only after DMARC is at quarantine/reject at 100%. Logo must be SVG Tiny PS; Gmail needs a VMC/CMC certificate |

**DMARC rollout.** Start with `p=none` and read the `rua` reports for 2–4 weeks until every legitimate source passes SPF or DKIM in alignment. Then `p=quarantine; pct=25`, raise to 100, and finally `p=reject`. Change Terraform `dmarc_policy` for the sending subdomain and the root record by hand.

**security.txt.** Served from `apps/web/public/.well-known/security.txt` at `https://zudomart.com/.well-known/security.txt` with `Contact: mailto:security@zudomart.com`. Renew the `Expires` date before 2027-10-01 (RFC 9116 asks for less than a year).

## Configuration

| Setting | Where | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_MAIL_DOMAIN` | web, webapp, seller, studio, ads, admin | `zudomart.com` |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `_PRIVACY_EMAIL`, `_LEGAL_EMAIL`, `_SELLERS_EMAIL`, `_CREATORS_EMAIL`, `_ADS_EMAIL`, `_BILLING_EMAIL`, `NEXT_PUBLIC_ADMIN_ACCESS_EMAIL` | per app, optional overrides | `<name>@` the domain |
| `EXPO_PUBLIC_MAIL_DOMAIN`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_PRIVACY_EMAIL` | mobile | `zudomart.com` |
| `ZUDOMART_MAIL_DOMAIN`, `ZUDOMART_MAIL_SENDING_DOMAIN`, `ZUDOMART_SUPPORT_EMAILS` | notifications service (email templates brand) | `zudomart.com`, `mail.zudomart.com`, `support@zudomart.com` |
| `SES_FROM_ADDRESS` | notifications service | `Zudomart <noreply@mail.zudomart.com>` (fallback; templates choose the sender) |
| `SUPPORT_NOTIFICATION_EMAILS` | apps/api | `support@zudomart.com` |
| `ZUDOMART_EMAIL_ASSET_BASE_URL` | notifications service | `https://cdn.zudomart.com/email` (hosts the 2x store badge PNGs from `packages/emailTemplates/assets/storeBadges/`) |

Store badges follow Apple's and Google's guidelines; sources and rules are in `packages/emailTemplates/assets/storeBadges/NOTICE.md`.
