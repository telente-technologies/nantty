import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cartsService, type AddProductToCartInput } from "@/services/commerce/carts.service";
import { useAuthStore } from "@/store/auth.store";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";

export const cartQueryKey = ["cart"] as const;

export function useMyCart(addressId: string | null = null) {
  const isSignedIn = useAuthStore((s) => s.status === "signedIn");
  return useQuery({ queryKey: [...cartQueryKey, addressId], queryFn: () => cartsService.fetchMyCart(addressId), placeholderData: keepPreviousData, enabled: isSignedIn });
}

export function useCartActions() {
  const queryClient = useQueryClient();
  const refreshCart = () => queryClient.invalidateQueries({ queryKey: cartQueryKey });

  const addProductToCart = useMutation({
    mutationFn: (input: AddProductToCartInput) => cartsService.addProductToCart(input),
    onSuccess: (_cart, input) => {
      refreshCart();
      void trackProductInteraction("product.addedToCart", { productId: input.productId, quantity: input.quantity });
    },
  });

  const changeCartItemQuantity = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) =>
      cartsService.changeCartItemQuantity(cartItemId, quantity),
    onSuccess: refreshCart,
  });

  const removeCartItem = useMutation({
    mutationFn: (cartItemId: string) => cartsService.removeCartItem(cartItemId),
    onSuccess: (_cart, cartItemId) => {
      refreshCart();
      void trackProductInteraction("product.removedFromCart", { cartItemId });
    },
  });

  return { addProductToCart, changeCartItemQuantity, removeCartItem };
}
