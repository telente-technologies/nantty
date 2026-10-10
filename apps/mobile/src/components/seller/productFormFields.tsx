import { Pressable, StyleSheet, View } from "react-native";

import { Trash24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface CustomVariantDraft {
  readonly name: string;
  readonly options: string;
}

export interface ProductFormValues {
  readonly name: string;
  readonly description: string;
  readonly priceInMajorUnits: string;
  readonly stock: string;
  readonly sizes: string;
  readonly colors: string;
  readonly variants: readonly CustomVariantDraft[];
}

export interface ProductFormFieldsProps {
  readonly values: ProductFormValues;
  readonly currency: string;
  readonly onChange: (patch: Partial<ProductFormValues>) => void;
}

export function ProductFormFields({ values, currency, onChange }: ProductFormFieldsProps) {
  const { colors } = useTheme();
  const updateVariant = (index: number, patch: Partial<CustomVariantDraft>) => {
    onChange({ variants: values.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)) });
  };
  const removeVariant = (index: number) => {
    onChange({ variants: values.variants.filter((_, i) => i !== index) });
  };
  return (
    <View style={styles.fields}>
      <TextField label="Product name" placeholder="e.g. Custom Mechanical Keyboard" value={values.name} onChangeText={(name) => onChange({ name })} maxLength={80} />
      <TextField label="Description" placeholder="Describe your product" value={values.description} onChangeText={(description) => onChange({ description })} multiline boxStyle={styles.multiline} />
      <View style={styles.row}>
        <TextField label={`Price (${currency})`} placeholder="0.00" keyboardType="decimal-pad" value={values.priceInMajorUnits} onChangeText={(priceInMajorUnits) => onChange({ priceInMajorUnits: priceInMajorUnits.replace(/[^\d.]/g, "") })} style={styles.half} />
        <TextField label="Stock" placeholder="0" keyboardType="number-pad" value={values.stock} onChangeText={(stock) => onChange({ stock: stock.replace(/\D/g, "") })} style={styles.half} />
      </View>
      <TextField label="Sizes" placeholder="S, M, L" value={values.sizes} onChangeText={(sizes) => onChange({ sizes })} autoCapitalize="characters" />
      <TextField label="Colors" placeholder="Black, White" value={values.colors} onChangeText={(c) => onChange({ colors: c })} />
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
        Separate sizes and colors with commas. Leave them empty if this product has no size or color. Buyers will pick one at checkout.
      </Text>
      <View style={styles.variantsHeader}>
        <Text size={14} weight={600} lineHeight={16.8}>
          Custom variants
        </Text>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          Optional — e.g. Storage, Material, Flavour. Not every product needs variants.
        </Text>
      </View>
      {values.variants.map((variant, index) => (
        <View key={index} style={styles.variantCard}>
          <TextField label="Variant name" placeholder="e.g. Storage" value={variant.name} onChangeText={(name) => updateVariant(index, { name })} maxLength={40} />
          <TextField label="Options (comma separated)" placeholder="e.g. 64GB, 128GB, 256GB" value={variant.options} onChangeText={(options) => updateVariant(index, { options })} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${variant.name || "variant"}`} hitSlop={12} onPress={() => removeVariant(index)} style={styles.removeRow}>
            <Trash24Icon size={18} />
            <Text size={13} weight={500} lineHeight={16.9} color={colors.error}>
              Remove
            </Text>
          </Pressable>
        </View>
      ))}
      <Button title="Add variant" onPress={() => onChange({ variants: [...values.variants, { name: "", options: "" }] })} />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  multiline: { height: 96, alignItems: "flex-start", paddingVertical: 12 },
  variantsHeader: { gap: 4, marginTop: 8 },
  variantCard: { gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E5E5E5" },
  removeRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
});
