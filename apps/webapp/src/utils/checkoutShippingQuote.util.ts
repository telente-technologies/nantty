import type { CartShippingQuote } from "@/types";

export interface CheckoutShippingQuoteState {
  readonly selectedAddressId: string | null;
  readonly quote: CartShippingQuote | null;
  readonly isFetching: boolean;
  readonly isError: boolean;
}

export function isCheckoutShippingQuoteReady(state: CheckoutShippingQuoteState): boolean {
  return Boolean(state.selectedAddressId)
    && Boolean(state.quote)
    && state.quote?.addressId === state.selectedAddressId
    && !!state.quote?.shippingQuoteRevision
    && !state.isFetching
    && !state.isError;
}
