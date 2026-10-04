export type CelebrationKind = "birthday" | "anniversary";
export type CelebrationSurface = "app" | "profile";

export interface CelebrationSurfaceState {
  readonly app: boolean;
  readonly profile: boolean;
}

export interface AnniversaryStats {
  readonly posts?: number;
  readonly followers?: number;
  readonly orders?: number;
  readonly lives?: number;
}

export interface ViewerCelebrations {
  readonly timezone: string;
  readonly timezoneConfigured: boolean;
  readonly localDate: string;
  readonly birthdayBalloonsVisible: boolean;
  readonly birthday: { readonly today: boolean; readonly age?: number; readonly shown: CelebrationSurfaceState };
  readonly anniversary: { readonly today: boolean; readonly years?: number; readonly shown: CelebrationSurfaceState; readonly stats?: AnniversaryStats };
}

export interface CelebrationSettingsUpdate {
  readonly timezone?: string;
  readonly birthdayBalloonsVisible?: boolean;
}

export interface ActiveCelebration {
  readonly kind: CelebrationKind;
  readonly title: string;
  readonly message: string;
  readonly stats: readonly { readonly label: string; readonly value: string }[];
}
