import { StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ORDER_SUCCESS_DESCRIPTION, ORDER_SUCCESS_SHOPPING_ROUTE } from "./orderSuccessCopy.util";

export function OrderSuccessScreen({ navigation, route }: MainScreenProps<"OrderSuccess">) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Check16Icon size={32} color={colors.white} />
        </View>
        <Text size={21} weight={600} lineHeight={25.2} align="center" accessibilityRole="header">
          Order placed
        </Text>
        <Text size={13} lineHeight={16.9} color={colors.textSubtle} align="center">
          {ORDER_SUCCESS_DESCRIPTION}
        </Text>
      </View>
      <View style={styles.footer}>
        <Button title="See payment protection" onPress={() => navigation.replace("EscrowStatus", { orderId: route.params.orderId })} />
        <Button variant="subtle" title="View order" onPress={() => navigation.replace("OrderDetail", { orderId: route.params.orderId })} />
        <Button
          variant="subtle"
          title="Continue shopping"
          onPress={() => navigation.replace(ORDER_SUCCESS_SHOPPING_ROUTE.name, ORDER_SUCCESS_SHOPPING_ROUTE.params)}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 40, alignItems: "center", justifyContent: "center", gap: 12 },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  footer: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
}));
