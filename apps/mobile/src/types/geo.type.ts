export type GeoLevel = "state" | "lga" | "city";

export interface GeoCountry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly levels: readonly GeoLevel[];
  readonly stateLabel: string;
  readonly lgaLabel: string;
}

export interface GeoArea {
  readonly id: string;
  readonly name: string;
  readonly parentId: string;
}

export interface GeoSelection {
  readonly countryId: string;
  readonly stateId: string | null;
  readonly lgaId: string | null;
  readonly cityId: string | null;
}
