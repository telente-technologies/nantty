import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { CartItemRow } from "@/components/cart/cartItemRow";
import { EmptyCartState } from "@/components/cart/emptyCartState";
import { OrderSummaryCard } from "@/components/cart/orderSummaryCard";
import { PurchaseTermsText } from "@/components/cart/purchaseTermsText";
import { Frame69424Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Header, HeaderAction } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useCartActions, useMyCart } from "@/hooks/useCart.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function CartScreen({ navigation }: MainScreenProps<"Cart">) {
  const cart = useMyCart();
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
        <ActivityIndicator style={styles.state} color={colors.primary} />
      </Screen>
    );
  }

  if (cart.isError || !cart.data) {
    return (
      <Screen>
        {header}
        <Text align="center" color={colors.textSubtle} style={styles.state}>
          Couldn't load your cart.
        </Text>
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
        <View>
          {summary.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onPress={() => navigation.navigate("ProductDetail", { productId: item.product.id })}
              onChangeQuantity={(quantity) => changeCartItemQuantity.mutate({ cartItemId: item.id, quantity })}
              onRemove={() => removeCartItem.mutate(item.id)}
            />
          ))}
        </View>
        <View style={styles.summary}>
          <OrderSummaryCard itemsTotal={summary.itemsTotal} shopDiscount={summary.shopDiscount} shipping={summary.shipping} total={summary.total} />
          <PurchaseTermsText />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Proceed to Checkout" onPress={() => navigation.navigate("Checkout")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: 64 },
  content: { paddingHorizontal: 12, paddingBottom: 24, flexGrow: 1 },
  summary: { marginTop: "auto", paddingTop: 40, gap: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
});
