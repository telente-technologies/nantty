import { useQuery } from "@tanstack/react-query";

import { cartsService } from "@/services/carts.service";

export const useShippingQuote = (addressId: string | null) =>
  useQuery({
    queryKey: ["cart", "shipping-quote", addressId],
    queryFn: () => cartsService.fetchShippingQuote(addressId!),
    enabled: addressId !== null,
    retry: false,
  });
