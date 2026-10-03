import { StyleSheet, View } from "react-native";

import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface ProductFormValues {
  readonly name: string;
  readonly description: string;
  readonly priceInMajorUnits: string;
  readonly stock: string;
  readonly sizes: string;
  readonly colors: string;
}

export interface ProductFormFieldsProps {
  readonly values: ProductFormValues;
  readonly currency: string;
  readonly onChange: (patch: Partial<ProductFormValues>) => void;
}

export function ProductFormFields({ values, currency, onChange }: ProductFormFieldsProps) {
  const { colors } = useTheme();
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
        Separate sizes and colors with commas. Buyers will pick one at checkout.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  multiline: { height: 96, alignItems: "flex-start", paddingVertical: 12 },
});
