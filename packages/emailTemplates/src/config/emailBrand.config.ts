import type { EmailBrandConfig } from "../emailTypes";

export const companyLegalNamePlaceholder = "ZUDOMART_COMPANY_LEGAL_NAME";
export const companyAddressPlaceholder = "ZUDOMART_COMPANY_ADDRESS";

export const defaultMailboxDomain = "nantty.com";
// Keep the currently authenticated outbound domain until a Nantty sending provider and its SPF/DKIM records are configured.
export const defaultSendingDomain = "mail.nantty.com";
export const defaultEmailAssetBaseUrl = "https://nantty.com";

export const storeBadgeFiles = {
  appStore: "storeBadges/app-store-badge-black@2x.png",
  playStore: "storeBadges/google-play-badge@2x.png",
} as const;

export const emailLogoFile = "brand/nantty-lockup.png";

export function buildEmailLogoUrl(assetBaseUrl: string): string {
  return `${assetBaseUrl.replace(/\/+$/, "")}/${emailLogoFile}`;
}

export function buildStoreBadgeUrls(assetBaseUrl: string): { readonly appStoreBadgeUrl: string; readonly playStoreBadgeUrl: string } {
  const base = assetBaseUrl.replace(/\/+$/, "");
  return { appStoreBadgeUrl: `${base}/${storeBadgeFiles.appStore}`, playStoreBadgeUrl: `${base}/${storeBadgeFiles.playStore}` };
}

export const defaultEmailBrand: EmailBrandConfig = {
  productName: "Nantty",
  companyLegalName: companyLegalNamePlaceholder,
  companyAddress: companyAddressPlaceholder,
  webBaseUrl: "https://nantty.com",
  helpCenterUrl: "https://nantty.com/help",
  sellerDashboardUrl: "https://creator.nantty.com",
  studioUrl: "https://creator.nantty.com",
  supportEmails: [`support@${defaultMailboxDomain}`],
  logoUrl: buildEmailLogoUrl(defaultEmailAssetBaseUrl),
  logoWidth: 150,
  appStoreUrl: "https://apps.apple.com/app/id0000000000",
  playStoreUrl: "https://play.google.com/store/apps/details?id=com.nantty.app",
  ...buildStoreBadgeUrls(defaultEmailAssetBaseUrl),
  mailboxDomain: defaultMailboxDomain,
  sendingDomain: defaultSendingDomain,
  senderName: "Nantty",
};

export type EmailBrandEnvironment = Readonly<Record<string, string | undefined>>;

function readDomain(value: string | undefined): string | undefined {
  const domain = value?.trim().toLowerCase().replace(/^@/, "");
  return domain && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : undefined;
}

function readBadgeUrl(value: string | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "none" ? null : value;
}

export function readEmailBrandFromEnvironment(environment: EmailBrandEnvironment): EmailBrandConfig {
  const pick = (name: string) => environment[name]?.trim() || undefined;
  const mailboxDomain = readDomain(pick("ZUDOMART_MAIL_DOMAIN")) ?? defaultEmailBrand.mailboxDomain;
  const sendingDomain = readDomain(pick("ZUDOMART_MAIL_SENDING_DOMAIN")) ?? (mailboxDomain === defaultMailboxDomain ? defaultSendingDomain : `mail.${mailboxDomain}`);
  const assetBaseUrl = pick("ZUDOMART_EMAIL_ASSET_BASE_URL");
  const badges = assetBaseUrl ? buildStoreBadgeUrls(assetBaseUrl) : { appStoreBadgeUrl: defaultEmailBrand.appStoreBadgeUrl, playStoreBadgeUrl: defaultEmailBrand.playStoreBadgeUrl };
  const appStoreId = pick("ZUDOMART_APP_STORE_ID")?.replace(/^id/i, "");
  const playPackage = pick("ZUDOMART_PLAY_PACKAGE");
  return {
    ...defaultEmailBrand,
    companyLegalName: pick("ZUDOMART_COMPANY_LEGAL_NAME") ?? defaultEmailBrand.companyLegalName,
    companyAddress: pick("ZUDOMART_COMPANY_ADDRESS") ?? defaultEmailBrand.companyAddress,
    webBaseUrl: pick("ZUDOMART_WEB_BASE_URL") ?? defaultEmailBrand.webBaseUrl,
    helpCenterUrl: pick("ZUDOMART_HELP_CENTER_URL") ?? defaultEmailBrand.helpCenterUrl,
    supportEmails: pick("ZUDOMART_SUPPORT_EMAILS")?.split(",").map((email) => email.trim()).filter(Boolean) ?? [`support@${mailboxDomain}`],
    logoUrl: readBadgeUrl(pick("ZUDOMART_EMAIL_LOGO_URL"), assetBaseUrl ? buildEmailLogoUrl(assetBaseUrl) : defaultEmailBrand.logoUrl),
    appStoreUrl: appStoreId && /^\d{6,12}$/.test(appStoreId) ? `https://apps.apple.com/app/id${appStoreId}` : defaultEmailBrand.appStoreUrl,
    playStoreUrl: playPackage ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(playPackage)}` : defaultEmailBrand.playStoreUrl,
    appStoreBadgeUrl: readBadgeUrl(pick("ZUDOMART_EMAIL_APP_STORE_BADGE_URL"), badges.appStoreBadgeUrl),
    playStoreBadgeUrl: readBadgeUrl(pick("ZUDOMART_EMAIL_PLAY_STORE_BADGE_URL"), badges.playStoreBadgeUrl),
    mailboxDomain,
    sendingDomain,
  };
}

export function isBrandConfigComplete(brand: EmailBrandConfig): boolean {
  return brand.companyLegalName !== companyLegalNamePlaceholder && brand.companyAddress !== companyAddressPlaceholder;
}
