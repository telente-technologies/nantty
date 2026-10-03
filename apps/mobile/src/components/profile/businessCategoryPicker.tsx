import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BusinessCategory, BusinessCategorySelection } from "@/types/socialGraph.type";
import { Cancel20Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";

export interface BusinessCategoryPickerProps {
  readonly categories: readonly BusinessCategory[];
  readonly value: readonly BusinessCategorySelection[];
  readonly onChange: (value: readonly BusinessCategorySelection[]) => void;
}

const describeSelection = (selection: BusinessCategorySelection, categories: readonly BusinessCategory[]) => {
  if (selection.customName) return `${selection.customName} (custom)`;
  const name = (id: string | null) => categories.find((category) => category.id === id)?.name;
  return [name(selection.categoryId), name(selection.subcategoryId)].filter(Boolean).join(" › ");
};

export function BusinessCategoryPicker({ categories, value, onChange }: BusinessCategoryPickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const topLevel = categories.filter((category) => category.parentId === null);
  const subcategories = categories.filter((category) => category.parentId === openCategoryId);
  const isAlreadySelected = (categoryId: string, subcategoryId: string | null) =>
    value.some((selection) => selection.categoryId === categoryId && selection.subcategoryId === subcategoryId);
  const addSelection = (selection: BusinessCategorySelection) => onChange([...value, selection]);
  const addCustomCategory = () => {
    const name = customName.trim();
    if (name.length < 2) return;
    addSelection({ categoryId: null, subcategoryId: null, customName: name });
    setCustomName("");
  };

  return (
    <View style={styles.root}>
      <Text size={14} lineHeight={16.8}>Categories (add as many as fit)</Text>
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((selection, index) => (
            <Pressable
              key={`${selection.categoryId}-${selection.subcategoryId}-${selection.customName}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${describeSelection(selection, categories)}`}
              onPress={() => onChange(value.filter((_, selectionIndex) => selectionIndex !== index))}
              style={styles.selected}
            >
              <IconRow icon={<Cancel20Icon size={12} color={colors.white} />}><Text size={12} weight={500} lineHeight={16} color={colors.white}>{describeSelection(selection, categories)}</Text></IconRow>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.chips}>
        {topLevel.map((category) => (
          <Chip key={category.id} kind="topic" label={category.name} selected={openCategoryId === category.id} onPress={() => setOpenCategoryId(category.id)} />
        ))}
      </View>
      {openCategoryId ? (
        <View style={styles.chips}>
          {subcategories.map((subcategory) => (
            <Chip
              key={subcategory.id}
              kind="filter"
              label={subcategory.name}
              selected={isAlreadySelected(openCategoryId, subcategory.id)}
              onPress={() => !isAlreadySelected(openCategoryId, subcategory.id) && addSelection({ categoryId: openCategoryId, subcategoryId: subcategory.id, customName: null })}
            />
          ))}
          {isAlreadySelected(openCategoryId, null) ? null : (
            <Chip kind="filter" label="Just this category" onPress={() => addSelection({ categoryId: openCategoryId, subcategoryId: null, customName: null })} />
          )}
        </View>
      ) : null}
      <TextField label="Something else? Add your own" placeholder="Custom category" value={customName} onChangeText={setCustomName} maxLength={40} />
      <Button title="Add custom category" variant="subtle" disabled={customName.trim().length < 2} onPress={addCustomCategory} />
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>Custom categories are reviewed by ZudoMart before they become public.</Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selected: { paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: colors.primarySolid, justifyContent: "center" },
}));
