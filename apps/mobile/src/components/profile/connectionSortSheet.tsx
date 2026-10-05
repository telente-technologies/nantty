import { Pressable, StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import type { ConnectionListPreference } from "@/store/listViewPreferences.store";
import { makeThemedStyles, useTheme } from "@/theme";

import { CONNECTION_FILTER_OPTIONS, CONNECTION_SORT_OPTIONS } from "./connectionSort.util";

export interface ConnectionSortSheetProps {
  readonly visible: boolean;
  readonly value: ConnectionListPreference;
  readonly showRelationshipFilter: boolean;
  readonly onChange: (value: ConnectionListPreference) => void;
  readonly onClose: () => void;
}

function OptionRow({ label, selected, onPress }: { readonly label: string; readonly selected: boolean; readonly onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} onPress={onPress} style={styles.row}>
      <Text size={typeScale.md} lineHeight={20} weight={selected ? 600 : 400}>{label}</Text>
      {selected ? <Check16Icon color={colors.primary} /> : null}
    </Pressable>
  );
}

export function ConnectionSortSheet({ visible, value, showRelationshipFilter, onChange, onClose }: ConnectionSortSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isDefault = value.sort === "recent" && value.filter === "all";
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Sort and filter">
      <View style={styles.body}>
        <Text size={typeScale.xs} lineHeight={16} weight={600} color={colors.textMuted} accessibilityRole="header">Sort by</Text>
        <View accessibilityRole="radiogroup">
          {CONNECTION_SORT_OPTIONS.map((option) => (
            <OptionRow key={option.value} label={option.label} selected={value.sort === option.value} onPress={() => onChange({ ...value, sort: option.value })} />
          ))}
        </View>
        {showRelationshipFilter ? (
          <>
            <Text size={typeScale.xs} lineHeight={16} weight={600} color={colors.textMuted} accessibilityRole="header" style={styles.groupTitle}>Show</Text>
            <View accessibilityRole="radiogroup">
              {CONNECTION_FILTER_OPTIONS.map((option) => (
                <OptionRow key={option.value} label={option.label} selected={value.filter === option.value} onPress={() => onChange({ ...value, filter: option.value })} />
              ))}
            </View>
          </>
        ) : null}
        <View style={styles.actions}>
          <Button title="Reset" variant="outline" disabled={isDefault} onPress={() => onChange({ sort: "recent", filter: "all" })} style={styles.action} />
          <Button title="Done" onPress={onClose} style={styles.action} />
        </View>
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: spacing[4], paddingBottom: spacing[4] },
  groupTitle: { marginTop: spacing[4] },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  actions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[6] },
  action: { flex: 1 },
}));
