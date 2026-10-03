import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme";

import { Header } from "./header";
import { Screen } from "./screen";
import { Text } from "./text";

export function PlaceholderScreen({ name }: { name: string }) {
  const { colors } = useTheme();
  return (
    <Screen>
      <Header title={name} />
      <View style={styles.body}>
        <Text color={colors.textFaint}>{name}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { flex: 1, alignItems: "center", justifyContent: "center" } });
