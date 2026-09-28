import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cartsService, type AddProductToCartInput } from "@/services/carts.service";
import type { Cart } from "@/types";

export const cartQueryKey = ["cart"] as const;

export function useMyCart() {
  return useQuery({ queryKey: cartQueryKey, queryFn: cartsService.fetchMyCart });
}

export function useCartActions() {
  const queryClient = useQueryClient();
  const storeUpdatedCart = (cart: Cart) => queryClient.setQueryData(cartQueryKey, cart);

  const addProductToCart = useMutation({
    mutationFn: (input: AddProductToCartInput) => cartsService.addProductToCart(input),
    onSuccess: storeUpdatedCart,
  });

  const changeCartItemQuantity = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) =>
      cartsService.changeCartItemQuantity(cartItemId, quantity),
    onMutate: async ({ cartItemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: cartQueryKey });
      const previousCart = queryClient.getQueryData<Cart>(cartQueryKey);
      if (previousCart) {
        storeUpdatedCart({
          ...previousCart,
          items: previousCart.items.map((item) => (item.id === cartItemId ? { ...item, quantity } : item)),
        });
      }
      return { previousCart };
    },
    onError: (_error, _input, context) => context?.previousCart && storeUpdatedCart(context.previousCart),
    onSuccess: storeUpdatedCart,
  });

  const removeCartItem = useMutation({
    mutationFn: (cartItemId: string) => cartsService.removeCartItem(cartItemId),
    onSuccess: storeUpdatedCart,
  });

  return { addProductToCart, changeCartItemQuantity, removeCartItem };
}
