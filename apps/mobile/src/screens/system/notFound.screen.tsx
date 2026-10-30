import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ErrorGlyph, SearchGlyph } from "@/components/icons/errorIcons";
import { ErrorScreen } from "@/components/ui/errorState";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import type { ErrorIconName } from "@/errors/errorExperience/errorKinds";
import { rootNavigationRef } from "@/navigation/navigationRef";
import { makeThemedStyles, useTheme } from "@/theme";
import { spacing } from "@/constants/spacing.constant";

interface Destination {
  readonly label: string;
  readonly icon: ErrorIconName;
  readonly go: () => void;
}

function navigate(name: string, params?: object): void {
  if (rootNavigationRef.isReady()) (rootNavigationRef.navigate as (route: string, routeParams?: object) => void)(name, params);
}

export const notFoundDestinations: readonly Destination[] = [
  { label: "Feed", icon: "house", go: () => navigate("Tabs", { screen: "Home" }) },
  { label: "Clips", icon: "playCircle", go: () => navigate("Tabs", { screen: "Clips" }) },
  { label: "Mart", icon: "storefront", go: () => navigate("Search", { scope: "mart", scopeLabel: "Mart" }) },
  { label: "Live", icon: "broadcast", go: () => navigate("Tabs", { screen: "Home" }) },
];

export function KeepExploring() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.explore}>
      <Pressable accessibilityRole="button" accessibilityLabel="Search Nantty" onPress={() => navigate("Search")} style={[styles.search, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
        <SearchGlyph color={colors.textSubtle} />
        <Text size={15} color={colors.textSubtle}>Search Nantty</Text>
      </Pressable>
      <View style={styles.chips}>
        {notFoundDestinations.map((destination) => (
          <Pressable key={destination.label} accessibilityRole="link" onPress={destination.go} style={[styles.chip, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
            <ErrorGlyph name={destination.icon} size={18} color={colors.primary} weight="regular" />
            <Text size={14} weight={600}>{destination.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function NotFoundScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ErrorScreen kind="notFound">
          <KeepExploring />
        </ErrorScreen>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  explore: { alignSelf: "stretch", gap: spacing[4], marginTop: spacing[4] },
  search: { flexDirection: "row", alignItems: "center", gap: spacing[3], minHeight: 48, paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing[2] },
  chip: { flexDirection: "row", flexGrow: 1, flexBasis: 100, minWidth: 0, alignItems: "center", justifyContent: "center", gap: spacing[2], minHeight: 44, paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
}));
