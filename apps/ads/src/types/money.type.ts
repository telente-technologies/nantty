export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface NumberRange {
  readonly lower: number;
  readonly upper: number;
}
