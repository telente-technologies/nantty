import type { EmailBrandConfig } from "../emailTypes";

export const companyLegalNamePlaceholder = "ZUDOMART_COMPANY_LEGAL_NAME";
export const companyAddressPlaceholder = "ZUDOMART_COMPANY_ADDRESS";

export const defaultEmailBrand: EmailBrandConfig = {
  productName: "Zudomart",
  companyLegalName: companyLegalNamePlaceholder,
  companyAddress: companyAddressPlaceholder,
  webBaseUrl: "https://zudomart.com",
  helpCenterUrl: "https://zudomart.com/help",
  sellerDashboardUrl: "https://dashboard.zudomart.com",
  studioUrl: "https://studio.zudomart.com",
  supportEmails: ["oyinlola.tech@icloud.com", "oluwayemioyinlola2@icloud.com"],
  logoUrl: null,
  logoWidth: 132,
  appStoreUrl: "https://apps.apple.com/app/zudomart/id0000000000",
  playStoreUrl: "https://play.google.com/store/apps/details?id=com.zudomart.app",
  appStoreBadgeUrl: null,
  playStoreBadgeUrl: null,
};

export type EmailBrandEnvironment = Readonly<Record<string, string | undefined>>;

export function readEmailBrandFromEnvironment(environment: EmailBrandEnvironment): EmailBrandConfig {
  const pick = (name: string) => environment[name]?.trim() || undefined;
  return {
    ...defaultEmailBrand,
    companyLegalName: pick("ZUDOMART_COMPANY_LEGAL_NAME") ?? defaultEmailBrand.companyLegalName,
    companyAddress: pick("ZUDOMART_COMPANY_ADDRESS") ?? defaultEmailBrand.companyAddress,
    webBaseUrl: pick("ZUDOMART_WEB_BASE_URL") ?? defaultEmailBrand.webBaseUrl,
    helpCenterUrl: pick("ZUDOMART_HELP_CENTER_URL") ?? defaultEmailBrand.helpCenterUrl,
    supportEmails: pick("ZUDOMART_SUPPORT_EMAILS")?.split(",").map((email) => email.trim()) ?? defaultEmailBrand.supportEmails,
    logoUrl: pick("ZUDOMART_EMAIL_LOGO_URL") ?? null,
    appStoreBadgeUrl: pick("ZUDOMART_EMAIL_APP_STORE_BADGE_URL") ?? null,
    playStoreBadgeUrl: pick("ZUDOMART_EMAIL_PLAY_STORE_BADGE_URL") ?? null,
  };
}

export function isBrandConfigComplete(brand: EmailBrandConfig): boolean {
  return brand.companyLegalName !== companyLegalNamePlaceholder && brand.companyAddress !== companyAddressPlaceholder;
}
