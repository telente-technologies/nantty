import { ScrollView, StyleSheet, View } from "react-native";

import { CartGrandTotalCard } from "@/components/cart/cartGrandTotalCard";
import { CartSellerGroupCard } from "@/components/cart/cartSellerGroupCard";
import { DeliveryAddressPicker } from "@/components/cart/deliveryAddressPicker";
import { EmptyCartState } from "@/components/cart/emptyCartState";
import { PurchaseTermsText } from "@/components/cart/purchaseTermsText";
import { Frame69424Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Header, HeaderAction } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { useDeliveryAddressStore } from "@/store/deliveryAddress.store";
import { useCartActions, useMyCart } from "@/hooks/useCart.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";

export function CartScreen({ navigation }: MainScreenProps<"Cart">) {
  const chosenAddressId = useDeliveryAddressStore((state) => state.chosenAddressId);
  const cart = useMyCart(chosenAddressId);
  const { changeCartItemQuantity, removeCartItem } = useCartActions();

  const header = (
    <Header
      title="Cart"
      paddingHorizontal={12}
      right={
        <HeaderAction label="Search" onPress={() => navigation.navigate("Search", { scope: "mart" })}>
          <Frame69424Icon />
        </HeaderAction>
      }
    />
  );

  if (cart.isLoading) {
    return (
      <Screen>
        {header}
        <ListSkeleton />
      </Screen>
    );
  }

  if (cart.isError || !cart.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={cart.error} message="Couldn't load your cart." onRetry={() => cart.refetch()} />
      </Screen>
    );
  }

  if (cart.data.items.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyCartState />
      </Screen>
    );
  }

  const summary = cart.data;
  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DeliveryAddressPicker onAddAddress={() => navigation.navigate("AddressForm")} />
        {summary.groups.map((group) => (
          <CartSellerGroupCard
            key={group.storeId}
            group={group}
            onOpenProduct={(productId) => navigation.navigate("ProductDetail", { productId })}
            onChangeQuantity={(cartItemId, quantity) => changeCartItemQuantity.mutate({ cartItemId, quantity })}
            onRemove={(cartItemId) => removeCartItem.mutate(cartItemId)}
          />
        ))}
        <View style={styles.summary}>
          <CartGrandTotalCard cart={summary} />
          <PurchaseTermsText />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Proceed to Checkout" disabled={!chosenAddressId || summary.payableGroupCount === 0} onPress={() => navigation.navigate("Checkout")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingBottom: 24, flexGrow: 1, gap: 16 },
  summary: { marginTop: "auto", paddingTop: 24, gap: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
});
