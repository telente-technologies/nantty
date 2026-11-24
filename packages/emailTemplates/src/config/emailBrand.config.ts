import type { EmailBrandConfig } from "../emailTypes";

export const companyLegalNamePlaceholder = "NANTTY_COMPANY_LEGAL_NAME";
export const companyAddressPlaceholder = "NANTTY_COMPANY_ADDRESS";

export const defaultMailboxDomain = "nantty.com";
// Keep the currently authenticated outbound domain until a Nantty sending provider and its SPF/DKIM records are configured.
export const defaultSendingDomain = "mail.nantty.com";
export const defaultEmailAssetBaseUrl = "https://nantty.com";

export const storeBadgeFiles = {
  appStore: "storeBadges/app-store-badge-black@2x.png",
  playStore: "storeBadges/google-play-badge@2x.png",
} as const;

export const emailLogoFile = "brand/nantty-lockup.png";

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}

export function buildEmailLogoUrl(assetBaseUrl: string): string {
  return `${trimTrailingSlashes(assetBaseUrl)}/${emailLogoFile}`;
}

export function buildStoreBadgeUrls(assetBaseUrl: string): { readonly appStoreBadgeUrl: string; readonly playStoreBadgeUrl: string } {
  const base = trimTrailingSlashes(assetBaseUrl);
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

const legacyEnvironmentNames = {
  mailboxDomain: "NANTTY_MAIL_DOMAIN",
  sendingDomain: "NANTTY_MAIL_SENDING_DOMAIN",
  assetBaseUrl: "NANTTY_EMAIL_ASSET_BASE_URL",
  appStoreId: "NANTTY_APP_STORE_ID",
  playPackage: "NANTTY_PLAY_PACKAGE",
  companyLegalName: "NANTTY_COMPANY_LEGAL_NAME",
  companyAddress: "NANTTY_COMPANY_ADDRESS",
  webBaseUrl: "NANTTY_WEB_BASE_URL",
  helpCenterUrl: "NANTTY_HELP_CENTER_URL",
  supportEmails: "NANTTY_SUPPORT_EMAILS",
  logoUrl: "NANTTY_EMAIL_LOGO_URL",
  appStoreBadgeUrl: "NANTTY_EMAIL_APP_STORE_BADGE_URL",
  playStoreBadgeUrl: "NANTTY_EMAIL_PLAY_STORE_BADGE_URL",
} as const;

function readDomain(value: string | undefined): string | undefined {
  const domain = value?.trim().toLowerCase().replace(/^@/, "");
  return domain && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : undefined;
}

function readBadgeUrl(value: string | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "none" ? null : value;
}

export function readEmailBrandFromEnvironment(environment: EmailBrandEnvironment): EmailBrandConfig {
  const pick = (...names: string[]) => names.map((name) => environment[name]?.trim()).find(Boolean) || undefined;
  const mailboxDomain = readDomain(pick("NANTTY_MAIL_DOMAIN", legacyEnvironmentNames.mailboxDomain)) ?? defaultEmailBrand.mailboxDomain;
  const sendingDomain = readDomain(pick("NANTTY_MAIL_SENDING_DOMAIN", legacyEnvironmentNames.sendingDomain)) ?? (mailboxDomain === defaultMailboxDomain ? defaultSendingDomain : `mail.${mailboxDomain}`);
  const assetBaseUrl = pick("NANTTY_EMAIL_ASSET_BASE_URL", legacyEnvironmentNames.assetBaseUrl);
  const badges = assetBaseUrl ? buildStoreBadgeUrls(assetBaseUrl) : { appStoreBadgeUrl: defaultEmailBrand.appStoreBadgeUrl, playStoreBadgeUrl: defaultEmailBrand.playStoreBadgeUrl };
  const appStoreId = pick("NANTTY_APP_STORE_ID", legacyEnvironmentNames.appStoreId)?.replace(/^id/i, "");
  const playPackage = pick("NANTTY_PLAY_PACKAGE", legacyEnvironmentNames.playPackage);
  return {
    ...defaultEmailBrand,
    companyLegalName: pick("NANTTY_COMPANY_LEGAL_NAME", legacyEnvironmentNames.companyLegalName) ?? defaultEmailBrand.companyLegalName,
    companyAddress: pick("NANTTY_COMPANY_ADDRESS", legacyEnvironmentNames.companyAddress) ?? defaultEmailBrand.companyAddress,
    webBaseUrl: pick("NANTTY_WEB_BASE_URL", legacyEnvironmentNames.webBaseUrl) ?? defaultEmailBrand.webBaseUrl,
    helpCenterUrl: pick("NANTTY_HELP_CENTER_URL", legacyEnvironmentNames.helpCenterUrl) ?? defaultEmailBrand.helpCenterUrl,
    supportEmails: pick("NANTTY_SUPPORT_EMAILS", legacyEnvironmentNames.supportEmails)?.split(",").map((email) => email.trim()).filter(Boolean) ?? [`support@${mailboxDomain}`],
    logoUrl: readBadgeUrl(pick("NANTTY_EMAIL_LOGO_URL", legacyEnvironmentNames.logoUrl), assetBaseUrl ? buildEmailLogoUrl(assetBaseUrl) : defaultEmailBrand.logoUrl),
    appStoreUrl: appStoreId && /^\d{6,12}$/.test(appStoreId) ? `https://apps.apple.com/app/id${appStoreId}` : defaultEmailBrand.appStoreUrl,
    playStoreUrl: playPackage ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(playPackage)}` : defaultEmailBrand.playStoreUrl,
    appStoreBadgeUrl: readBadgeUrl(pick("NANTTY_EMAIL_APP_STORE_BADGE_URL", legacyEnvironmentNames.appStoreBadgeUrl), badges.appStoreBadgeUrl),
    playStoreBadgeUrl: readBadgeUrl(pick("NANTTY_EMAIL_PLAY_STORE_BADGE_URL", legacyEnvironmentNames.playStoreBadgeUrl), badges.playStoreBadgeUrl),
    mailboxDomain,
    sendingDomain,
  };
}

export function isBrandConfigComplete(brand: EmailBrandConfig): boolean {
  return brand.companyLegalName !== companyLegalNamePlaceholder && brand.companyAddress !== companyAddressPlaceholder;
}
