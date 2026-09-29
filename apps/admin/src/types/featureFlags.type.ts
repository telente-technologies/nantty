export type ClientPlatform = "IOS" | "ANDROID" | "WEB";

export interface FeatureFlagContent {
  readonly description: string;
  readonly owner: string;
  readonly isEnabled: boolean;
  readonly isKillSwitch: boolean;
  readonly rolloutPercent: number;
  readonly targeting: { readonly countries: readonly string[]; readonly platforms: readonly ClientPlatform[]; readonly minimumAppVersion: string | null };
}

export type ExperimentStatus = "DRAFT" | "RUNNING" | "STOPPED";

export interface ExperimentVariant {
  readonly key: string;
  readonly description: string;
  readonly weightPercent: number;
}

export interface ExperimentContent {
  readonly name: string;
  readonly hypothesis: string;
  readonly status: ExperimentStatus;
  readonly primaryMetric: string;
  readonly variants: readonly ExperimentVariant[];
  readonly startedAt: string | null;
}
