export interface CheckoutShippingQuoteState {
  readonly selectedAddressId: string | null;
  readonly quoteAddressId: string | null | undefined;
  readonly shippingQuoteRevision?: string | null;
  readonly hasQuote: boolean;
  readonly isFetching: boolean;
  readonly isPlaceholderData: boolean;
  readonly isError: boolean;
}

export function isCheckoutShippingQuoteReady(state: CheckoutShippingQuoteState): boolean {
  return Boolean(state.selectedAddressId)
    && state.hasQuote
    && state.quoteAddressId === state.selectedAddressId
    && !!state.shippingQuoteRevision
    && !state.isFetching
    && !state.isPlaceholderData
    && !state.isError;
}
