import { useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View, type TextInputInstance } from "react-native";

import { Cancel20Icon, CaretLeft16Icon, CaretRight16Icon, Plus16Icon } from "@/components/icons";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { addOptionValues, moveOptionValue, PRODUCT_OPTION_LIMITS } from "@/utils/productOptions.util";

export interface OptionValuesInputProps {
  readonly optionName: string;
  readonly values: readonly string[];
  readonly pendingText: string;
  readonly onChange: (patch: { values?: string[]; pendingText?: string }) => void;
  readonly onRemoveValue: (value: string) => void;
  readonly autoFocus?: boolean;
}

const SEPARATOR = /[,\n;]/;

export function placeholderForOption(optionName: string): string {
  const name = optionName.trim().toLocaleLowerCase();
  if (name.startsWith("size")) return "e.g. M";
  if (name.startsWith("colo")) return "e.g. Red";
  if (name.startsWith("storage")) return "e.g. 128GB";
  if (name.startsWith("material")) return "e.g. Cotton";
  return "Type a value";
}

export function OptionValuesInput({ optionName, values, pendingText, onChange, onRemoveValue, autoFocus }: OptionValuesInputProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const inputRef = useRef<TextInputInstance>(null);
  const latest = useRef({ values, pendingText });
  latest.current = { values, pendingText };
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const label = optionName.trim() || "option";
  const atCap = values.length >= PRODUCT_OPTION_LIMITS.maxValuesPerGroup;

  const commit = (text: string, keepText = "") => {
    if (text.trim().length === 0) {
      if (latest.current.pendingText === keepText) return;
      latest.current = { ...latest.current, pendingText: keepText };
      onChange({ pendingText: keepText });
      return;
    }
    const result = addOptionValues(latest.current.values, text);
    setError(result.error);
    const leftover = result.added.length === 0 ? text : keepText;
    latest.current = { values: result.values, pendingText: leftover };
    onChange({ values: result.values, pendingText: leftover });
    if (result.added.length > 0) AccessibilityInfo.announceForAccessibility(result.added.length === 1 ? `Added ${result.added[0]}` : `Added ${result.added.length} values`);
    else if (result.error) AccessibilityInfo.announceForAccessibility(result.error);
    inputRef.current?.focus();
  };

  const handleChangeText = (text: string) => {
    if (error) setError(null);
    const previous = latest.current.pendingText;
    if (!SEPARATOR.test(text)) {
      latest.current = { ...latest.current, pendingText: text };
      onChange({ pendingText: text });
      return;
    }
    const pasted = text.length - previous.length > 1;
    if (pasted) return commit(text);
    const parts = text.split(SEPARATOR);
    const keep = parts.pop() ?? "";
    commit(parts.join(","), keep.trimStart());
  };

  const remove = (index: number) => {
    const value = values[index];
    if (value === undefined) return;
    setSelectedIndex(null);
    setError(null);
    onRemoveValue(value);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    onChange({ values: moveOptionValue(values, index, target) });
    setSelectedIndex(target);
    AccessibilityInfo.announceForAccessibility(`${values[index]} moved to position ${target + 1} of ${values.length}`);
  };

  const canAdd = pendingText.trim().length > 0 && !atCap;
  const selected = selectedIndex !== null && selectedIndex < values.length ? selectedIndex : null;

  return (
    <View style={styles.wrap}>
      {values.length > 0 ? (
        <View style={styles.chips}>
          {values.map((value, index) => (
            <View key={value} style={[styles.chip, selected === index && styles.chipSelected]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${value}, ${index + 1} of ${values.length}`}
                accessibilityHint="Double tap to reorder"
                accessibilityState={{ selected: selected === index }}
                accessibilityActions={[{ name: "moveEarlier", label: "Move earlier" }, { name: "moveLater", label: "Move later" }]}
                onAccessibilityAction={(event) => move(index, event.nativeEvent.actionName === "moveEarlier" ? -1 : 1)}
                onPress={() => setSelectedIndex(selected === index ? null : index)}
                onLongPress={() => setSelectedIndex(index)}
                hitSlop={4}
              >
                <Text size={13} weight={500} lineHeight={16.9} numberOfLines={1} style={styles.chipText}>{value}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${value}`} hitSlop={10} onPress={() => remove(index)}>
                <Cancel20Icon size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {selected !== null ? (
        <View style={styles.moveBar}>
          <Text size={12} lineHeight={16} color={colors.textMuted} style={styles.moveLabel} numberOfLines={1}>Move “{values[selected]}”</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Move ${values[selected]} earlier`} disabled={selected === 0} onPress={() => move(selected, -1)} style={[styles.moveButton, selected === 0 && styles.disabled]} hitSlop={6}>
            <CaretLeft16Icon size={16} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Move ${values[selected]} later`} disabled={selected === values.length - 1} onPress={() => move(selected, 1)} style={[styles.moveButton, selected === values.length - 1 && styles.disabled]} hitSlop={6}>
            <CaretRight16Icon size={16} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Done reordering" onPress={() => setSelectedIndex(null)} hitSlop={6}>
            <Text size={13} weight={600} lineHeight={16} color={colors.primary}>Done</Text>
          </Pressable>
        </View>
      ) : null}
      <TextField
        ref={inputRef}
        label={`New ${label.toLocaleLowerCase()} value`}
        placeholder={atCap ? `Up to ${PRODUCT_OPTION_LIMITS.maxValuesPerGroup} values` : placeholderForOption(optionName)}
        value={pendingText}
        editable={!atCap}
        autoFocus={autoFocus}
        invalid={error !== null}
        onChangeText={handleChangeText}
        onSubmitEditing={() => commit(latest.current.pendingText)}
        submitBehavior="submit"
        returnKeyType="done"
        autoCorrect={false}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel={`Add ${label.toLocaleLowerCase()} value`} accessibilityState={{ disabled: !canAdd }} disabled={!canAdd} onPress={() => commit(latest.current.pendingText)} hitSlop={8} style={[styles.addButton, !canAdd && styles.disabled]}>
            <Plus16Icon size={14} color={colors.primary} />
            <Text size={13} weight={600} lineHeight={16} color={colors.primary}>Add</Text>
          </Pressable>
        }
      />
      {error ? (
        <Text size={12} lineHeight={16} color={colors.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : values.length === 0 ? (
        <Text size={12} lineHeight={16} color={colors.textSubtle}>Type a value and tap Add. You can paste a list like S, M, L.</Text>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  wrap: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", paddingLeft: 10, paddingRight: 8, height: 32, borderRadius: 16, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chip },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipText: { flexShrink: 1 },
  moveBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  moveLabel: { flex: 1 },
  moveButton: { width: 32, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, height: 30 },
  disabled: { opacity: 0.4 },
}));
