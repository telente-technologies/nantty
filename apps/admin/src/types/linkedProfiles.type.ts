export type LinkedProfileKind = "store" | "business" | "brand";

export interface LinkedProfileItem {
  readonly kind: LinkedProfileKind;
  readonly profileId: string;
  readonly storeId: string | null;
  readonly status: "active" | "held" | "retired";
  readonly holdReason: string | null;
  readonly name: string;
  readonly handle: string;
  readonly showsMart: boolean;
}

export interface LinkedProfilesSummary {
  readonly accountId: string;
  readonly items: readonly LinkedProfileItem[];
  readonly canCreate: { readonly store: boolean; readonly business: boolean; readonly brand: boolean };
  readonly choiceRequired: boolean;
}
