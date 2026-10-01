declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_SITE_URL?: string;
    readonly NEXT_PUBLIC_MARKETING_SITE_URL?: string;
    readonly NEXT_PUBLIC_SELLER_WEB_URL?: string;
    readonly NEXT_PUBLIC_ADS_MANAGER_URL?: string;
    readonly WEBAPP_ORIGIN?: string;
    readonly WEBAPP_API_URL?: string;
    readonly WEBAPP_MEDIA_URL?: string;
    readonly WEBAPP_USE_MOCKS?: string;
    readonly WEBAPP_SESSION_SECRET?: string;
  }
}
