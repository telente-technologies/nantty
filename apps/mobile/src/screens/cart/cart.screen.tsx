import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CartGrandTotalCard } from "@/components/cart/cartGrandTotalCard";
import { CartSellerGroupCard } from "@/components/cart/cartSellerGroupCard";
import { DeliveryAddressPicker } from "@/components/cart/deliveryAddressPicker";
import { EmptyCartState } from "@/components/cart/emptyCartState";
import { PurchaseTermsText } from "@/components/cart/purchaseTermsText";
import { Frame69424Icon, Trash24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Header, HeaderAction } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { useDeliveryAddressStore } from "@/store/deliveryAddress.store";
import { useCartActions, useMyCart } from "@/hooks/useCart.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export function CartScreen({ navigation }: MainScreenProps<"Cart">) {
  const { colors } = useTheme();
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

  if (cart.data.items.length === 0 && (cart.data.unavailableItems?.length ?? 0) === 0) {
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
        {(summary.unavailableItems?.length ?? 0) > 0 ? (
          <View style={[styles.unavailableSection, { borderColor: colors.divider }]}>
            <Text size={14} weight={600} lineHeight={17} accessibilityRole="header">Unavailable products</Text>
            {summary.unavailableItems?.map((item) => (
              <View key={item.id} style={styles.unavailableRow}>
                <Text size={13} lineHeight={18} color={colors.textMuted} style={styles.unavailableLabel}>This product is no longer available.</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Remove unavailable product from cart" hitSlop={8} onPress={() => removeCartItem.mutate(item.id)}>
                  <Trash24Icon />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {summary.groups.map((group) => (
          <CartSellerGroupCard
            key={group.storeId}
            group={group}
            onOpenProduct={(productId) => navigation.navigate("ProductDetail", { productId })}
            onChangeQuantity={(cartItemId, quantity) => changeCartItemQuantity.mutate({ cartItemId, quantity })}
            onRemove={(cartItemId) => removeCartItem.mutate(cartItemId)}
          />
        ))}
        {summary.items.length > 0 ? (
          <View style={styles.summary}>
            <CartGrandTotalCard cart={summary} />
            <PurchaseTermsText />
          </View>
        ) : (
          <Text size={13} lineHeight={19} color={colors.textMuted} accessibilityRole="status">Remove unavailable products before adding items to checkout.</Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Proceed to Checkout" disabled={!chosenAddressId || summary.payableGroupCount === 0 || (summary.unavailableItemCount ?? summary.unavailableItems?.length ?? 0) > 0} onPress={() => navigation.navigate("Checkout")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingBottom: 24, flexGrow: 1, gap: 16 },
  summary: { marginTop: "auto", paddingTop: 24, gap: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  unavailableSection: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  unavailableRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  unavailableLabel: { flex: 1 },
});
