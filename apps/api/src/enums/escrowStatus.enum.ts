export const EscrowStatus = {
  HELD: "held",
  DISPUTED: "disputed",
  RELEASED: "released",
  REFUNDED: "refunded",
} as const;
export type EscrowStatus = (typeof EscrowStatus)[keyof typeof EscrowStatus];
