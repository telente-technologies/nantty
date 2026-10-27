export interface StoreLinkConfig {
  readonly appStoreId?: string;
  readonly playPackage?: string;
}

export interface StoreLinks {
  readonly appStoreUrl: string | null;
  readonly playStoreUrl: string | null;
}

export const defaultPlayPackage = "com.nantty.app";

export function buildStoreLinks({ appStoreId, playPackage }: StoreLinkConfig): StoreLinks {
  const appleId = appStoreId?.trim().replace(/^id/i, "") ?? "";
  const androidPackage = playPackage?.trim() ?? "";
  return {
    appStoreUrl: /^\d{6,12}$/.test(appleId) ? `https://apps.apple.com/app/id${appleId}` : null,
    playStoreUrl: /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(androidPackage) ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(androidPackage)}` : null,
  };
}
