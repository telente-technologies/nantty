import { useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";

import { Plus16Icon, Trash24Icon } from "@/components/icons";
import { OptionValuesInput } from "@/components/seller/optionValuesInput";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { createOptionGroupDraft, describeOptionGroupError, OPTION_NAME_SUGGESTIONS, PRODUCT_OPTION_LIMITS, type OptionGroupDraft } from "@/utils/productOptions.util";

type GroupsUpdate = (groups: readonly OptionGroupDraft[]) => OptionGroupDraft[];

export interface ProductOptionsEditorProps {
  readonly groups: readonly OptionGroupDraft[];
  readonly onGroupsChange: (update: GroupsUpdate) => void;
  readonly describeRemovalImpact?: (nextGroups: OptionGroupDraft[]) => string | null;
}

const sameName = (left: string, right: string) => left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

export function ProductOptionsEditor({ groups, onGroupsChange, describeRemovalImpact }: ProductOptionsEditorProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const lastGroup = groups[groups.length - 1];
  const canAddGroup = groups.length < PRODUCT_OPTION_LIMITS.maxGroups && (lastGroup === undefined || lastGroup.values.length > 0);
  const suggestions = OPTION_NAME_SUGGESTIONS.filter((name) => !groups.some((group) => sameName(group.name, name) || (sameName(name, "Colour") && sameName(group.name, "Color"))));

  const updateGroup = (key: string, patch: Partial<OptionGroupDraft>) => onGroupsChange((current) => current.map((group) => (group.key === key ? { ...group, ...patch } : group)));

  const addGroup = (name: string) => {
    const group = createOptionGroupDraft(name);
    setFocusKey(group.key);
    onGroupsChange((current) => (current.length >= PRODUCT_OPTION_LIMITS.maxGroups ? [...current] : [...current, group]));
    AccessibilityInfo.announceForAccessibility(name ? `${name} option added` : "Custom option added. Name it first.");
  };

  const confirmThen = (title: string, message: string | null, apply: () => void) => {
    if (!message) return apply();
    showAlertWithButtons(title, message, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: apply }], { intent: "remove" });
  };

  const removeValue = (group: OptionGroupDraft, value: string) => {
    const next = groups.map((candidate) => (candidate.key === group.key ? { ...candidate, values: candidate.values.filter((existing) => existing !== value) } : candidate));
    confirmThen(`Remove ${value}?`, describeRemovalImpact?.(next) ?? null, () => {
      onGroupsChange((current) => current.map((candidate) => (candidate.key === group.key ? { ...candidate, values: candidate.values.filter((existing) => existing !== value) } : candidate)));
      AccessibilityInfo.announceForAccessibility(`Removed ${value}`);
    });
  };

  const removeGroup = (group: OptionGroupDraft) => {
    const label = group.name.trim() || "this option";
    const impact = describeRemovalImpact?.(groups.filter((candidate) => candidate.key !== group.key)) ?? null;
    const message = impact ?? (group.values.length > 0 ? `This removes ${label} and its ${group.values.length} ${group.values.length === 1 ? "value" : "values"}. Variants built from it go too.` : null);
    confirmThen(`Remove ${label}?`, message, () => {
      onGroupsChange((current) => current.filter((candidate) => candidate.key !== group.key));
      AccessibilityInfo.announceForAccessibility(`Removed ${label} option`);
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text size={14} weight={600} lineHeight={16.8}>Options</Text>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Optional. Add sizes, colours or other choices buyers pick at checkout. Up to {PRODUCT_OPTION_LIMITS.maxGroups} options.</Text>
      </View>
      {groups.map((group, index) => {
        const error = describeOptionGroupError(group, groups);
        const showError = error !== null && !(group.values.length === 0 && group.pendingText.trim() === "" && group.name.trim() !== "");
        return (
          <View key={group.key} style={styles.card} accessibilityLabel={`Option ${index + 1}: ${group.name || "unnamed"}`}>
            <View style={styles.cardHeader}>
              <TextField
                label={`Option ${index + 1} name`}
                placeholder="e.g. Size"
                value={group.name}
                maxLength={PRODUCT_OPTION_LIMITS.maxNameBytes}
                autoFocus={focusKey === group.key && group.name === ""}
                onChangeText={(name) => updateGroup(group.key, { name })}
                returnKeyType="next"
                style={styles.nameField}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${group.name.trim() || `option ${index + 1}`}`} hitSlop={10} onPress={() => removeGroup(group)} style={styles.removeGroup}>
                <Trash24Icon size={18} />
              </Pressable>
            </View>
            {group.name.trim() === "" ? (
              <View style={styles.suggestions}>
                {suggestions.map((name) => (
                  <Pressable key={name} accessibilityRole="button" accessibilityLabel={`Name it ${name}`} onPress={() => updateGroup(group.key, { name })} style={styles.suggestion}>
                    <Text size={12} weight={500} lineHeight={16} color={colors.textMuted}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <OptionValuesInput
              optionName={group.name}
              values={group.values}
              pendingText={group.pendingText}
              autoFocus={focusKey === group.key && group.name !== ""}
              onChange={(patch) => updateGroup(group.key, patch)}
              onRemoveValue={(value) => removeValue(group, value)}
            />
            {showError ? <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          </View>
        );
      })}
      {canAddGroup ? (
        <View style={styles.addArea}>
          <Text size={13} weight={600} lineHeight={16}>{groups.length === 0 ? "Add option" : "Add another option"}</Text>
          <View style={styles.suggestions}>
            {[...suggestions, "Custom"].map((name) => (
              <Pressable key={name} accessibilityRole="button" accessibilityLabel={name === "Custom" ? "Add a custom option" : `Add ${name} option`} onPress={() => addGroup(name === "Custom" ? "" : name)} style={[styles.suggestion, styles.addChip]}>
                <Plus16Icon size={12} color={colors.primary} />
                <Text size={12} weight={600} lineHeight={16} color={colors.primary}>{name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : groups.length >= PRODUCT_OPTION_LIMITS.maxGroups ? (
        <Text size={12} lineHeight={16} color={colors.textSubtle}>You have the most options a product can have ({PRODUCT_OPTION_LIMITS.maxGroups}).</Text>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  wrap: { gap: 12 },
  header: { gap: 4, marginTop: 8 },
  card: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.divider },
  cardHeader: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  nameField: { flex: 1 },
  removeGroup: { width: 40, height: 42, alignItems: "center", justifyContent: "center" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: colors.chip },
  addChip: { backgroundColor: colors.primaryTint },
  addArea: { gap: 8 },
}));
