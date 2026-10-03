import { Pressable, StyleSheet, View } from "react-native";

import { BuildingStore20Icon, MessageShare20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";

export type StoreTab = "products" | "posts";

export function StoreTabs({ active, onChange }: { active: StoreTab; onChange: (tab: StoreTab) => void }) {
  const styles = useStyles();
  const tab = (key: StoreTab, label: string, icon: React.ReactNode) => (
    <Pressable
      key={key}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active === key }}
      onPress={() => onChange(key)}
      style={[styles.tab, active === key && styles.activeTab]}
    >
      {icon}
      <Text size={14} lineHeight={16.8}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tab("products", "Products", <BuildingStore20Icon />)}
      {tab("posts", "Posts", <MessageShare20Icon />)}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { marginTop: 24, paddingHorizontal: 16, flexDirection: "row", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tab: { flex: 1, height: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  activeTab: { borderBottomWidth: 1, borderBottomColor: colors.black },
}));
