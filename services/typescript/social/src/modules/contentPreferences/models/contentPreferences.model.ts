export interface ContentPreferencesView {
  readonly showSensitiveWithoutWarning: boolean;
  readonly canChangeSensitiveContentSetting: boolean;
  readonly ageBracket: "adult" | "minor" | "unknown";
}
