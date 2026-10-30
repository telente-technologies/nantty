# Nantty email addresses

Owner decision, 2026-10-04: every Nantty address is on the company domain. This replaces the earlier rule that the product only showed the owner's iCloud addresses.

- **Human-facing addresses** use the root domain: `<name>@nantty.com`.
- **Automated mail** is sent through Amazon SES from the sending subdomain `mail.nantty.com`, so its reputation is kept apart from the people's mailboxes.
- Nothing in the product hardcodes an address. Each app builds them from its brand config (`NEXT_PUBLIC_MAIL_DOMAIN`, `EXPO_PUBLIC_MAIL_DOMAIN`, `NANTTY_MAIL_DOMAIN`, `NANTTY_MAIL_SENDING_DOMAIN`), defaulting to the addresses below. The shared helper is `buildNanttyEmailAddresses` in `packages/webKit/src/contact/nanttyEmailAddresses.ts`; email senders are chosen by `selectEmailSender` in `packages/emailTemplates/src/config/emailSenders.config.ts`.

**Current routing (2026-10-28).** Cloudflare Email Routing forwards the public contact addresses listed below, plus `oyinlola@nantty.com` used in the investor deck, to the owner's verified Gmail destination. These are receive-only forwarding aliases, not separate inboxes; Email Routing does not let the owner send mail as `@nantty.com`. Do not put the forwarding destination in product code, outgoing email, or public/legal pages. A future team mailbox provider can replace these temporary routes.

## Human addresses (root domain)

Type: **mailbox** is a real inbox with its own login; **alias** delivers into another mailbox; **group** is a shared inbox or distribution list with several members (Google Groups collaborative inbox or a helpdesk).

| Address | Type | Purpose | Who reads it | Where it is used |
| --- | --- | --- | --- | --- |
| support@nantty.com | forwarding alias (Cloudflare) | Buyer and account help: orders, payments, escrow, disputes, sign-in | Owner inbox temporarily | Web contact page, footers, help centre "Contact support", email footer, Reply-To of most transactional mail, API `SUPPORT_NOTIFICATION_EMAILS`, mobile Settings › Support, webapp |
| help@nantty.com | alias → support@ | Catches people who guess "help@" | Support team | Not shown in the product |
| billing@nantty.com | group | Receipts, invoices, subscriptions, VAT, card checks, ad billing | Finance and support | Reply-To of payments and receipt emails, Ads billing pages |
| payouts@nantty.com | group | Seller and creator payouts, bank details, failed transfers | Finance | Reserved for payout pages and payout email copy (not shown yet) |
| sellers@nantty.com | forwarding alias (Cloudflare) | Store applications, business verification, listings, fees | Owner inbox temporarily | Seller dashboard landing, login and footer, web contact page, Reply-To of seller emails |
| creators@nantty.com | forwarding alias (Cloudflare) | Creator Program applications, earnings, Studio | Owner inbox temporarily | Studio landing, FAQ, login and footer, Reply-To of creator emails |
| ads@nantty.com | forwarding alias (Cloudflare) | Advertisers, campaigns, ad policy questions | Owner inbox temporarily | Ads landing, login, policy page, not-found page, footer |
| legal@nantty.com | mailbox | Legal notices, terms questions, law-enforcement requests | Legal / owner | Terms of service, admin legal documents |
| privacy@nantty.com | forwarding alias (Cloudflare) | Data-subject requests (access, deletion, export), cookies | Owner inbox temporarily | Privacy and cookie policies, web contact page, mobile data export, Reply-To of privacy and legal emails |
| dpo@nantty.com | mailbox (or alias → privacy@ until a named DPO) | Data Protection Officer under the Nigeria Data Protection Act 2023; regulators (NDPC) and data subjects | Appointed DPO | Privacy policy |
| security@nantty.com | forwarding alias (Cloudflare) | Vulnerability reports; admin VPN / IP allow-list access problems | Owner inbox temporarily | `/.well-known/security.txt` on nantty.com, README, admin sign-in and restricted pages, web contact page |
| abuse@nantty.com | group | Spam, phishing, fraud and platform abuse reports from outside (also what other providers mail about our IPs) | Trust & Safety | Reported via WHOIS/abuse contacts; not shown in the app |
| copyright@nantty.com | group | DMCA-style copyright and trademark notices and counter-notices | Trust & Safety (IP) | Terms of service (infringement section), help centre, Reply-To of copyright claim emails |
| trustandsafety@nantty.com | group | Appeals and questions about strikes, restrictions and suspensions | Trust & Safety | Reply-To of trust and account-status emails |
| verification@nantty.com | group | Checkmark and identity verification questions | Verification team | Reply-To of checkmark and verification emails |
| partnerships@nantty.com | group | Brands, logistics and payment partners | Business development | README |
| press@nantty.com | forwarding alias (Cloudflare) | Journalists and media kits | Owner inbox temporarily | Web contact page, README |
| careers@nantty.com | group | Job applications | Hiring | Careers page when it ships |
| hello@nantty.com | forwarding alias (Cloudflare) | General enquiries; Reply-To of marketing emails | Owner inbox temporarily | Web contact page "anything else", README, Reply-To of marketing |
| oyinlola@nantty.com | forwarding alias (Cloudflare) | Founder contact shown in the investor deck | Owner inbox | Investor deck |
| dmarc@nantty.com | mailbox (or a DMARC reporting service address) | Aggregate DMARC reports (`rua`) | Engineering | DNS only (`infra/aws/envs/*/terraform.tfvars`) |

## Automated senders (sending subdomain)

These addresses only send. Mail to them must not be read by people; replies go to the Reply-To shown below.

| Address | Sends | Reply-To | Notes |
| --- | --- | --- | --- |
| noreply@mail.nantty.com | Auth and security codes, orders, escrow, seller, creator, checkmarks, trust, privacy/legal notices, support updates | support@ (seller → sellers@, creator → creators@, checkmarks → verification@, trust → trustandsafety@, copyright → copyright@, privacy/legal → privacy@) | Default `SES_FROM_ADDRESS` fallback |
| receipts@mail.nantty.com | Payment receipts, coin receipts, subscription receipts, refunds, failed payments | billing@ | Display name "Nantty Receipts" |
| notifications@mail.nantty.com | Social notifications, milestones, digests and marketing | support@ (marketing → hello@) | Marketing carries `List-Unsubscribe` and one-click unsubscribe |
| alerts@mail.nantty.com | Internal only: ops alarms, support-queue and moderation alerts to staff | not set | Never sent to customers |
| bounce.mail.nantty.com (MAIL FROM / Return-Path) | Not an address you type: SES uses `<id>@bounce.mail.nantty.com` as the envelope sender | — | Bounces and complaints come back through SES → SNS → SQS (`notifications-ses-feedback`) and are written to the suppression list automatically. Nobody reads a bounce mailbox |

### Reply-to policy

1. Automated mail never comes from a human address and never asks people to reply to `noreply@`.
2. Every automated message sets Reply-To to the team that can act on it (table above), so a reply always reaches a person.
3. Support replies (ticket updates) are sent from `noreply@mail.nantty.com` with Reply-To `support@nantty.com`; the helpdesk threads replies by the ticket reference in the subject.
4. Security emails (codes, new sign-ins, password changes) reply to support@ and always say we will never ask for a password, PIN or code.
5. Staff use their own `firstname@nantty.com` mailbox only for one-to-one conversations, never for bulk or automated mail.

## DNS setup

Prod values; the Terraform module `infra/aws/modules/ses` creates the SES records for `mail_domain` (prod: `mail.nantty.com`).

| Record | Name | Value | Notes |
| --- | --- | --- | --- |
| MX | `nantty.com` | Cloudflare Email Routing (`route1/2/3.mx.cloudflare.net`) | Current inbound forwarding; do not replace without migrating routing |
| SPF (TXT) | `nantty.com` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | Current Cloudflare Email Routing record; review before adding any mailbox sender |
| SPF (TXT) | `bounce.mail.nantty.com` | `v=spf1 include:amazonses.com ~all` | Custom MAIL FROM for SES (Terraform) |
| MX | `bounce.mail.nantty.com` | `10 feedback-smtp.eu-west-1.amazonses.com` | Custom MAIL FROM (Terraform) |
| DKIM (3 × CNAME) | `<token>._domainkey.mail.nantty.com` | `<token>.dkim.amazonses.com` | SES Easy DKIM, 2048-bit (Terraform) |
| DKIM | `google._domainkey.nantty.com` | provider key | Sign human mail too |
| DMARC (TXT) | `_dmarc.nantty.com` | `v=DMARC1; p=none; rua=mailto:dmarc@nantty.com; adkim=r; aspf=r; fo=1` | Organisational policy; covers subdomains unless they have their own |
| DMARC (TXT) | `_dmarc.mail.nantty.com` | same, from Terraform `dmarc_policy` | Starts at `p=none` |
| BIMI (TXT, optional) | `default._bimi.nantty.com` | `v=BIMI1; l=https://nantty.com/bimi/logo.svg; a=<VMC or CMC .pem>` | Only after DMARC is at quarantine/reject at 100%. Logo must be SVG Tiny PS; Gmail needs a VMC/CMC certificate |

**DMARC rollout.** Start with `p=none` and read the `rua` reports for 2–4 weeks until every legitimate source passes SPF or DKIM in alignment. Then `p=quarantine; pct=25`, raise to 100, and finally `p=reject`. Change Terraform `dmarc_policy` for the sending subdomain and the root record by hand.

**security.txt.** Served from `apps/web/public/.well-known/security.txt` at `https://nantty.com/.well-known/security.txt` with `Contact: mailto:security@nantty.com`. Renew the `Expires` date before 2027-10-01 (RFC 9116 asks for less than a year).

## Configuration

| Setting | Where | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_MAIL_DOMAIN` | web, webapp, seller, studio, ads, admin | `nantty.com` |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `_PRIVACY_EMAIL`, `_LEGAL_EMAIL`, `_SELLERS_EMAIL`, `_CREATORS_EMAIL`, `_ADS_EMAIL`, `_BILLING_EMAIL`, `NEXT_PUBLIC_ADMIN_ACCESS_EMAIL` | per app, optional overrides | `<name>@` the domain |
| `EXPO_PUBLIC_MAIL_DOMAIN`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_PRIVACY_EMAIL` | mobile | `nantty.com` |
| `NANTTY_MAIL_DOMAIN`, `NANTTY_MAIL_SENDING_DOMAIN`, `NANTTY_SUPPORT_EMAILS` | notifications service (email templates brand) | `nantty.com`, `mail.nantty.com`, `support@nantty.com` |
| `SES_FROM_ADDRESS` | notifications service | `Nantty <noreply@mail.nantty.com>` (fallback; templates choose the sender) |
| `SUPPORT_NOTIFICATION_EMAILS` | ts-notifications | `support@nantty.com` |
| `NANTTY_EMAIL_ASSET_BASE_URL` | notifications service | `https://cdn.nantty.com/email` (hosts the 2x store badge PNGs from `packages/emailTemplates/assets/storeBadges/`) |

Store badges follow Apple's and Google's guidelines; sources and rules are in `packages/emailTemplates/assets/storeBadges/NOTICE.md`.
