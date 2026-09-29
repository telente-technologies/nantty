export interface CartItemRecord {
  readonly id: string;
  readonly userId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly createdAt: Date;
}

export const MAXIMUM_CART_LINE_QUANTITY = 99;
