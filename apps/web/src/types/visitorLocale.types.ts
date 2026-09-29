export interface VisitorLocale {
  readonly countryCode: string | null;
  readonly currency: string;
  readonly isCountrySupported: boolean;
}
