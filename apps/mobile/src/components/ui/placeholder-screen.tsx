import { StyleSheet, View } from "react-native";

import { Header } from "./header";
import { Screen } from "./screen";
import { Text } from "./text";

export function PlaceholderScreen({ name }: { name: string }) {
  return (
    <Screen>
      <Header title={name} />
      <View style={styles.body}>
        <Text color="#909090">{name}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { flex: 1, alignItems: "center", justifyContent: "center" } });
