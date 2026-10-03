import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";

import { ShoppingCart24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useMyCart } from "@/hooks/useCart.hook";

export function CartHeaderButtonShownOnlyWhenCartHasItems() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { data: cart } = useMyCart();
  const totalItemCount = cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0;

  if (totalItemCount === 0) return null;

  const badgeLabel = totalItemCount > 99 ? "99+" : String(totalItemCount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cart, ${totalItemCount} ${totalItemCount === 1 ? "item" : "items"}`}
      hitSlop={10}
      onPress={() => navigation.navigate("Cart")}
    >
      <ShoppingCart24Icon />
      <View style={styles.badge}>
        <Text size={10} weight={600} lineHeight={12} color={colors.white}>
          {badgeLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySolid,
    alignItems: "center",
    justifyContent: "center",
  },
}));
